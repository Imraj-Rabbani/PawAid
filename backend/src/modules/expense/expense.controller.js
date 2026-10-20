import z from "zod";
import { prisma } from "../../db.js"
import { uploadToR2 } from "../../services/upload.services.js";
import { orderNumber } from "../order/order.controller.js";


// Rescue expense documentation (PRD §21). The volunteer handling a rescue
// records what they spent on it, backed by a receipt photo or one of their
// marketplace orders. Nothing here moves money: wallet funds can only be spent
// in the marketplace or transferred (PRD §12.1), so this is a public record of
// where a rescue's money went, not a ledger entry.

// keep in sync with UPDATABLE_STATUSES in rescue.controller.js: expenses keep
// coming in after the rescue too, e.g. follow-up vet visits
const EXPENSE_STATUSES = ["ASSIGNED", "IN_PROGRESS", "RESOLVED"]
// an order that never went through isn't money spent
const UNSPENT_ORDER_STATUSES = ["CANCELLED", "REFUNDED"]


const expenseSelect = {
    id: true,
    amount: true,
    description: true,
    receiptUrl: true,
    createdAt: true,
    volunteer: { select: { id: true, user: { select: { id: true, name: true, profilePictureUrl: true } } } },
    // product names only: the delivery details on an order stay private
    order: {
        select: {
            id: true,
            status: true,
            items: { select: { quantity: true, product: { select: { name: true } } } },
        },
    },
}

function withOrderNumber(expense) {
    return expense.order
        ? { ...expense, order: { ...expense.order, number: orderNumber(expense.order.id) } }
        : expense
}

class ExpenseError extends Error {
    constructor(message, statusCode = 400) {
        super(message)
        this.statusCode = statusCode
    }
}


// Anyone can see what a rescue's money was spent on, newest first
export async function listExpenses(req, res){
    try {
        const postId = z.uuid().safeParse(req.params.postId)
        if (!postId.success) {
            return res.status(404).json({ message: "Post not found" })
        }

        const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50)
        const cursor = z.uuid().safeParse(req.query.cursor)
        const where = { rescuePostId: postId.data }

        // one extra row tells us whether there is more
        const [expenses, totals] = await Promise.all([
            prisma.rescueExpense.findMany({
                where,
                take: limit + 1,
                ...(cursor.success && { cursor: { id: cursor.data }, skip: 1 }),
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                select: expenseSelect,
            }),
            prisma.rescueExpense.aggregate({ where, _sum: { amount: true }, _count: true }),
        ])

        const hasMore = expenses.length > limit
        if (hasMore) expenses.pop()

        return res.json({
            message: "Expenses listed",
            data: expenses.map(withOrderNumber),
            total: totals._sum.amount ?? 0,
            count: totals._count,
            nextCursor: hasMore ? expenses[expenses.length - 1].id : null
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch expenses" });
    }
}


// The volunteer handling a rescue records something they spent on it
export async function createExpense(req, res){
    try {
        const postId = z.uuid().safeParse(req.params.postId)
        if (!postId.success) {
            return res.status(404).json({ message: "Post not found" })
        }


        const { amount, description, orderId } = req.body
        if (!req.file && !orderId) {
            return res.status(400).json({ message: "Add a receipt photo or link the marketplace order" })
        }

        const post = await prisma.rescuePost.findUnique({
            where: { id: postId.data },
            select: { id: true, status: true, assignedVolunteerId: true },
        })
        if (!post) {
            return res.status(404).json({ message: "Post not found" })
        }
        if (post.assignedVolunteerId !== req.volunteer.id) {
            return res.status(403).json({ message: "Only the volunteer handling this rescue can record its expenses" })
        }
        if (!EXPENSE_STATUSES.includes(post.status)) {
            return res.status(409).json({ message: "This rescue is no longer taking expenses" })
        }

        if (orderId) {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                select: { buyerId: true, status: true },
            })
            if (!order || order.buyerId !== req.user.id) {
                return res.status(404).json({ message: "Order not found" })
            }
            if (UNSPENT_ORDER_STATUSES.includes(order.status)) {
                return res.status(409).json({ message: "A cancelled order can't be recorded as an expense" })
            }
        }

        // checked above first so a rejected request doesn't upload anything
        const receiptUrl = req.file
            ? await uploadToR2(
                req.file.buffer,
                `rescue-expenses/${post.id}-${Date.now()}.${req.file.mimetype.split("/")[1]}`,
                req.file.mimetype
            )
            : null

        const expense = await prisma.$transaction(async (tx) => {
            if (orderId) {
                // lock the order so two expenses can't both claim its last taka
                const [order] = await tx.$queryRaw`
                    SELECT total_amount FROM orders WHERE id = ${orderId}::uuid FOR UPDATE
                `
                const claimed = await tx.rescueExpense.aggregate({ where: { orderId }, _sum: { amount: true } })
                const left = order.total_amount - (claimed._sum.amount ?? 0)
                if (amount > left) {
                    throw new ExpenseError(left > 0
                        ? `Only ৳${left.toLocaleString()} of this order is left to record`
                        : "This order has already been recorded in full", 409)
                }
            }

            return tx.rescueExpense.create({
                data: {
                    rescuePostId: post.id,
                    volunteerId: req.volunteer.id,
                    amount,
                    description,
                    receiptUrl,
                    orderId,
                },
                select: expenseSelect,
            })
        })

        return res.status(201).json({ message: "Expense recorded", data: withOrderNumber(expense) })
    } catch (error) {
        if (error instanceof ExpenseError) {
            return res.status(error.statusCode).json({ message: error.message })
        }
        console.error(error);
        res.status(500).json({ message: "Failed to record expense" });
    }
}


// A volunteer can take back an expense they recorded by mistake
export async function deleteExpense(req, res){
    try {
        const expenseId = z.uuid().safeParse(req.params.expenseId)
        if (!expenseId.success) {
            return res.status(404).json({ message: "Expense not found" })
        }

        const { count } = await prisma.rescueExpense.deleteMany({
            where: { id: expenseId.data, volunteerId: req.volunteer.id },
        })
        if (count === 0) {
            return res.status(404).json({ message: "Expense not found" })
        }

        return res.json({ message: "Expense removed" })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to remove expense" });
    }
}
