import { z } from "zod";
import { prisma } from "../../db.js";
import { debitWallet, InsufficientFundsError } from "../../services/wallet.services.js";

// ========================================
// CHECKOUT (PRD §15, §22, §35, §40)
// ========================================

const checkoutSchema = z.object({
    items: z
        .array(z.object({
            productId: z.uuid("Invalid product."),
            quantity: z.number("Quantity must be a number.").int("Quantity must be a whole number.").min(1).max(99),
        }), "Your cart is empty.")
        .min(1, "Your cart is empty.")
        .max(48, "Too many different products in one order."),
    // online payments (bKash, Nagad, card) are switched off for now
    paymentMethod: z.enum(["CASH", "WALLET"], "Choose a payment method."),
    delivery: z.object({
        name: z.string("Recipient name is required.").trim().min(3, "Recipient name is too short.").max(100, "Recipient name is too long."),
        phone: z.string("Phone number is required.").trim().regex(/^\+?[0-9][0-9 -]{5,18}[0-9]$/, "Enter a valid phone number."),
        address: z.string("Delivery address is required.").trim().min(10, "Enter the full delivery address.").max(500, "Address must be 500 characters or fewer."),
    }, "Delivery details are required."),
    saveAddress: z.boolean().optional(),
    // the total the buyer saw; if prices moved since, they confirm again instead of being charged a surprise
    expectedTotal: z.number().int().optional(),
})

export const orderSelect = {
    id: true,
    totalAmount: true,
    paymentMethod: true,
    status: true,
    deliveryName: true,
    deliveryPhone: true,
    deliveryAddress: true,
    createdAt: true,
    buyerId: true,
    payment: { select: { status: true, reference: true } },
    items: {
        select: {
            id: true,
            quantity: true,
            unitPrice: true,
            product: { select: { id: true, name: true, imageUrl: true, category: { select: { name: true } } } },
        },
    },
}

class CheckoutError extends Error {
    constructor(message, statusCode = 400, code) {
        super(message)
        this.statusCode = statusCode
        this.code = code
    }
}

export const orderNumber = (id) => id.slice(0, 8).toUpperCase()

export async function createOrder(req, res) {
    try {
        const parsed = checkoutSchema.safeParse(req.body ?? {})
        if (!parsed.success) {
            return res.status(400).json({
                message: "Validation failed",
                errors: parsed.error.flatten().fieldErrors,
            })
        }

        const { paymentMethod, delivery, saveAddress, expectedTotal } = parsed.data
        const buyerId = req.user.id

        // merge repeated lines, and always lock products in the same order so two
        // checkouts sharing products can't deadlock each other
        const quantities = new Map()
        for (const { productId, quantity } of parsed.data.items) {
            quantities.set(productId, (quantities.get(productId) ?? 0) + quantity)
        }
        const productIds = [...quantities.keys()].sort()

        const products = await prisma.product.findMany({
            where: { id: { in: productIds }, active: true },
            select: { id: true, name: true, sellingPrice: true, costPrice: true, stockQty: true },
        })
        if (products.length !== productIds.length) {
            throw new CheckoutError("Some items in your cart are no longer available.", 409, "CART_CHANGED")
        }

        const byId = new Map(products.map((product) => [product.id, product]))
        // prices always come from the database, never from the request
        const lines = productIds.map((id) => ({ product: byId.get(id), quantity: quantities.get(id) }))
        const total = lines.reduce((sum, line) => sum + line.product.sellingPrice * line.quantity, 0)

        for (const { product, quantity } of lines) {
            if (product.stockQty < quantity) {
                throw new CheckoutError(
                    product.stockQty > 0
                        ? `Only ${product.stockQty} of ${product.name} left in stock.`
                        : `${product.name} is out of stock.`,
                    409,
                    "CART_CHANGED",
                )
            }
        }
        if (expectedTotal !== undefined && expectedTotal !== total) {
            throw new CheckoutError("Prices have changed since you opened checkout. Check the new total.", 409, "CART_CHANGED")
        }

        const buyer = await prisma.user.findUnique({
            where: { id: buyerId },
            select: { phone: true, wallet: { select: { id: true, balance: true } }, volunteerProfile: { select: { id: true, status: true } } },
        })
        const activeVolunteer = buyer?.volunteerProfile?.status === "ACTIVE" ? buyer.volunteerProfile : null

        const paidNow = paymentMethod === "WALLET"
        if (paidNow) {
            // wallet funds are donations, so only an active volunteer may spend them, and only here (PRD §8, §35)
            if (!activeVolunteer) throw new CheckoutError("Only active volunteers can pay from their wallet.", 403)
            if (!buyer.wallet) throw new CheckoutError("Wallet not found.", 404)
            // fail fast with a clear message; debitWallet re-checks atomically inside the transaction
            if (buyer.wallet.balance < total) throw new InsufficientFundsError()
        }

        // stock, order, payment, ledger entry and wallet debit succeed or fail together (PRD §40)
        const order = await prisma.$transaction(async (tx) => {
            for (const { product, quantity } of lines) {
                // the stock check and the decrement are one statement, so two buyers
                // can't both take the last unit
                const { count } = await tx.product.updateMany({
                    where: { id: product.id, active: true, stockQty: { gte: quantity } },
                    data: { stockQty: { decrement: quantity } },
                })
                if (count === 0) {
                    throw new CheckoutError(`${product.name} just sold out. Check your cart and try again.`, 409, "CART_CHANGED")
                }
            }

            const payment = await tx.payment.create({
                // cash is collected by the courier, so it stays PENDING until marked paid on delivery
                data: {
                    amount: total,
                    method: paymentMethod,
                    status: paidNow ? "COMPLETED" : "PENDING",
                    reference: paidNow ? "WALLET_PURCHASE" : "CASH_ON_DELIVERY",
                },
            })

            const order = await tx.order.create({
                data: {
                    buyerId,
                    paymentId: payment.id,
                    totalAmount: total,
                    paymentMethod,
                    // a wallet order is paid in full, so it goes straight to CONFIRMED; a cash
                    // order waits as PENDING, and isn't counted as a sale until it is paid
                    status: paidNow ? "CONFIRMED" : "PENDING",
                    deliveryName: delivery.name,
                    deliveryPhone: delivery.phone,
                    deliveryAddress: delivery.address,
                    items: {
                        create: lines.map(({ product, quantity }) => ({
                            productId: product.id,
                            quantity,
                            unitPrice: product.sellingPrice,
                            unitCost: product.costPrice,
                        })),
                    },
                },
                select: orderSelect,
            })

            const transaction = await tx.financialTransaction.create({
                data: {
                    type: "ORDER_PAYMENT",
                    source: paidNow ? "WALLET" : "CASH_ON_DELIVERY",
                    destination: "MARKETPLACE",
                    amount: total,
                    relatedUserId: buyerId,
                    relatedVolunteerId: activeVolunteer?.id ?? null,
                    relatedOrderId: order.id,
                    paymentId: payment.id,
                    // revenue only counts COMPLETED rows, so expected cash stays out of it until collected
                    status: paidNow ? "COMPLETED" : "PENDING",
                    reference: `Order #${orderNumber(order.id)}`,
                },
            })

            if (paidNow) {
                // throws InsufficientFundsError, which rolls the whole order back
                await debitWallet(tx, {
                    walletId: buyer.wallet.id,
                    amount: total,
                    transactionId: transaction.id,
                    reference: `Marketplace order #${orderNumber(order.id)}`,
                })
            }

            if (saveAddress) {
                await tx.user.update({
                    where: { id: buyerId },
                    data: { address: delivery.address, ...(!buyer.phone && { phone: delivery.phone }) },
                })
            }

            return order
        }, { maxWait: 10000, timeout: 20000 })

        return res.status(201).json({ message: "Order placed", data: order })
    } catch (error) {
        if (error instanceof InsufficientFundsError) {
            return res.status(400).json({ message: "Not enough money in your wallet" })
        }
        if (error instanceof CheckoutError) {
            return res.status(error.statusCode).json({ message: error.message, code: error.code })
        }
        console.error(error);
        res.status(500).json({ message: "Failed to place your order" });
    }
}

export async function getOrder(req, res) {
    try {
        const orderId = z.uuid().safeParse(req.params.orderId)
        if (!orderId.success) return res.status(404).json({ message: "Order not found" })

        const order = await prisma.order.findUnique({ where: { id: orderId.data }, select: orderSelect })

        // someone else's order is reported as missing rather than forbidden
        if (!order || (order.buyerId !== req.user.id && req.user.role !== "ADMIN")) {
            return res.status(404).json({ message: "Order not found" })
        }

        return res.json({ message: "Order fetched", data: order })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch order" });
    }
}
