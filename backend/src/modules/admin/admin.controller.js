import z from "zod";
import { prisma } from "../../db.js"
import { uploadToR2 } from "../../services/upload.services.js";
import { creditWallet } from "../../services/wallet.services.js";
import { creditFund, PAWAID_FUND_ID } from "../../services/fund.services.js";
import { orderNumber } from "../order/order.controller.js";
import { NOT_REFUNDED, refundHeldDonations } from "../donation/donation.controller.js";
import { changedFields, logAdminAction, statusText } from "../../services/audit.services.js";

const publicUserSelect = { id: true, name: true, profilePictureUrl: true };

// Admin tables page by offset so filters and page numbers stay simple
function pageParams(query) {
    const page = Math.max(parseInt(query.page) || 1, 1)
    const limit = Math.min(Math.max(parseInt(query.limit) || 20, 1), 100)
    return { page, limit, skip: (page - 1) * limit }
}

function pageInfo({ page, limit }, total) {
    return { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) }
}

// "" or an unknown value means "no filter"
function enumFilter(values, value) {
    return values.includes(value) ? value : undefined
}

function searchTerm(query) {
    return typeof query.search === "string" ? query.search.trim() : ""
}

function validationError(res, parsed) {
    return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
    })
}


// ========================================
// OVERVIEW
// ========================================

export async function getStats(req, res) {
    try {
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

        const [
            usersByRole, usersByStatus, newUsers, volunteersByStatus, postsByStatus,
            reportsByStatus, areas, donations, monthDonations, topUps, walletTotal, ordersByStatus,
        ] = await Promise.all([
            prisma.user.groupBy({ by: ["role"], _count: true }),
            prisma.user.groupBy({ by: ["status"], _count: true }),
            prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
            prisma.volunteerProfile.groupBy({ by: ["status"], _count: true }),
            prisma.rescuePost.groupBy({ by: ["status"], _count: true }),
            prisma.postReport.groupBy({ by: ["status"], _count: true }),
            prisma.rescueArea.count(),
            // community donations only; the PawAid Fund's donations are marketplace profit
            prisma.donation.aggregate({ where: { donorId: { not: null }, ...NOT_REFUNDED }, _sum: { amount: true }, _count: true }),
            prisma.donation.aggregate({
                where: { donorId: { not: null }, createdAt: { gte: monthStart }, ...NOT_REFUNDED },
                _sum: { amount: true },
                _count: true,
            }),
            prisma.financialTransaction.aggregate({
                where: { source: "TOP_UP", status: "COMPLETED" },
                _sum: { amount: true },
            }),
            prisma.wallet.aggregate({ _sum: { balance: true } }),
            prisma.order.groupBy({ by: ["status"], _count: true }),
        ])

        // groupBy rows -> { KEY: count }
        const tally = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r._count]))
        const total = (rows) => rows.reduce((sum, r) => sum + r._count, 0)

        return res.json({
            message: "Stats fetched",
            data: {
                users: {
                    total: total(usersByRole),
                    newThisWeek: newUsers,
                    byRole: tally(usersByRole, "role"),
                    byStatus: tally(usersByStatus, "status"),
                },
                volunteers: {
                    total: total(volunteersByStatus),
                    byStatus: tally(volunteersByStatus, "status"),
                },
                posts: {
                    total: total(postsByStatus),
                    byStatus: tally(postsByStatus, "status"),
                },
                reports: {
                    total: total(reportsByStatus),
                    byStatus: tally(reportsByStatus, "status"),
                },
                orders: {
                    total: total(ordersByStatus),
                    byStatus: tally(ordersByStatus, "status"),
                },
                areas,
                finance: {
                    donationsTotal: donations._sum.amount ?? 0,
                    donationCount: donations._count,
                    donationsThisMonth: monthDonations._sum.amount ?? 0,
                    donationCountThisMonth: monthDonations._count,
                    topUpsTotal: topUps._sum.amount ?? 0,
                    walletBalanceTotal: walletTotal._sum.balance ?? 0,
                },
            }
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch stats" });
    }
}


// ========================================
// USERS
// ========================================

const USER_ROLES = ["USER", "VOLUNTEER", "ADMIN"]
const USER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"]

const userStatusSchema = z.object({
    status: z.enum(["ACTIVE", "SUSPENDED"], "Status must be ACTIVE or SUSPENDED."),
})

const adminUserSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    status: true,
    profilePictureUrl: true,
    createdAt: true,
    wallet: { select: { balance: true } },
    volunteerProfile: { select: { id: true, status: true } },
    _count: { select: { rescuePosts: true, donations: true, postReports: true } },
}

export async function listUsers(req, res) {
    try {
        const paging = pageParams(req.query)
        const search = searchTerm(req.query)

        const where = {
            role: enumFilter(USER_ROLES, req.query.role),
            status: enumFilter(USER_STATUSES, req.query.status),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { email: { contains: search, mode: "insensitive" } },
                    { phone: { contains: search } },
                ],
            }),
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: adminUserSelect,
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                skip: paging.skip,
                take: paging.limit,
            }),
            prisma.user.count({ where }),
        ])

        return res.json({
            message: "Users listed",
            data: users,
            pagination: pageInfo(paging, total),
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch users" });
    }
}

// Suspending signs the user out on their next request (requireAuth checks status)
export async function updateUserStatus(req, res) {
    try {
        const userId = z.uuid().safeParse(req.params.userId)
        if (!userId.success) {
            return res.status(404).json({ message: "User not found" })
        }

        const parsed = userStatusSchema.safeParse(req.body ?? {})
        if (!parsed.success) return validationError(res, parsed)

        if (userId.data === req.user.id) {
            return res.status(400).json({ message: "You cannot change your own status" })
        }

        const user = await prisma.user.findUnique({
            where: { id: userId.data },
            select: { id: true, role: true, status: true, name: true, email: true },
        })
        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }

        if (user.role === "ADMIN") {
            return res.status(403).json({ message: "Admins cannot be suspended" })
        }

        const suspending = parsed.data.status === "SUSPENDED"

        const updated = await prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
                where: { id: user.id },
                data: { status: parsed.data.status },
                select: adminUserSelect,
            })
            await logAdminAction(tx, req.user.id, {
                action: suspending ? "USER_SUSPENDED" : "USER_REACTIVATED",
                targetType: "USER",
                targetId: user.id,
                summary: `${suspending ? "Suspended" : "Reactivated"} ${user.name} (${user.email})`,
                details: { from: user.status, to: parsed.data.status },
            })
            return updated
        })

        return res.json({
            message: suspending ? "User suspended" : "User reactivated",
            data: updated,
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to update user" });
    }
}


// ========================================
// VOLUNTEERS
// ========================================

const VOLUNTEER_STATUSES = ["PENDING", "ACTIVE", "INACTIVE", "SUSPENDED"]

const volunteerStatusSchema = z.object({
    status: z.enum(["ACTIVE", "SUSPENDED"], "Status must be ACTIVE or SUSPENDED."),
})

// Admins see the NID and wallet (read only) that the public listing hides
const adminVolunteerSelect = {
    id: true,
    nid: true,
    description: true,
    status: true,
    createdAt: true,
    rescueArea: true,
    user: {
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            profilePictureUrl: true,
            wallet: { select: { balance: true } },
        },
    },
    _count: { select: { assignedPosts: true, donations: true } },
}

export async function listVolunteers(req, res) {
    try {
        const paging = pageParams(req.query)
        const search = searchTerm(req.query)
        const areaId = z.uuid().safeParse(req.query.areaId)

        const where = {
            status: enumFilter(VOLUNTEER_STATUSES, req.query.status),
            ...(areaId.success && { rescueAreaId: areaId.data }),
            ...(search && {
                OR: [
                    { user: { name: { contains: search, mode: "insensitive" } } },
                    { user: { email: { contains: search, mode: "insensitive" } } },
                    { nid: { contains: search } },
                ],
            }),
        }

        const [volunteers, total] = await Promise.all([
            prisma.volunteerProfile.findMany({
                where,
                select: adminVolunteerSelect,
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                skip: paging.skip,
                take: paging.limit,
            }),
            prisma.volunteerProfile.count({ where }),
        ])

        return res.json({
            message: "Volunteers listed",
            data: volunteers,
            pagination: pageInfo(paging, total),
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch volunteers" });
    }
}

// Revoke / restore. The role stays VOLUNTEER; requireActiveVolunteer checks this
// status, so a revoked volunteer loses volunteer-only actions straight away (PRD §5.2)
export async function updateVolunteerStatus(req, res) {
    try {
        const volunteerId = z.uuid().safeParse(req.params.volunteerId)
        if (!volunteerId.success) {
            return res.status(404).json({ message: "Volunteer not found" })
        }

        const parsed = volunteerStatusSchema.safeParse(req.body ?? {})
        if (!parsed.success) return validationError(res, parsed)

        const revoking = parsed.data.status === "SUSPENDED"

        const volunteer = await prisma.$transaction(async (tx) => {
            const current = await tx.volunteerProfile.findUnique({
                where: { id: volunteerId.data },
                select: { id: true, status: true, user: { select: { name: true } } },
            })
            if (!current) return null

            const volunteer = await tx.volunteerProfile.update({
                where: { id: current.id },
                data: { status: parsed.data.status },
                select: adminVolunteerSelect,
            })
            await logAdminAction(tx, req.user.id, {
                action: revoking ? "VOLUNTEER_REVOKED" : "VOLUNTEER_RESTORED",
                targetType: "VOLUNTEER",
                targetId: current.id,
                summary: `${revoking ? "Revoked" : "Restored"} volunteer status for ${current.user.name}`,
                details: { from: current.status, to: parsed.data.status },
            })
            return volunteer
        })

        if (!volunteer) {
            return res.status(404).json({ message: "Volunteer not found" })
        }

        return res.json({
            message: revoking ? "Volunteer status revoked" : "Volunteer status restored",
            data: volunteer,
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to update volunteer" });
    }
}


// ========================================
// POSTS
// ========================================

const POST_STATUSES = ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"]
// these statuses only make sense with a volunteer on the rescue
const NEEDS_VOLUNTEER = ["ASSIGNED", "IN_PROGRESS"]

const postStatusSchema = z.object({
    status: z.enum(POST_STATUSES, "Invalid post status."),
})

const adminPostSelect = {
    id: true,
    title: true,
    description: true,
    status: true,
    donationTarget: true,
    donationReceived: true,
    createdAt: true,
    creator: { select: { ...publicUserSelect, email: true, status: true } },
    rescueArea: true,
    images: { select: { id: true, imageUrl: true }, take: 1 },
    assignedVolunteer: { select: { id: true, user: { select: publicUserSelect } } },
    _count: {
        select: {
            comments: true,
            upvotes: true,
            reports: { where: { status: { in: ["PENDING", "REVIEWED"] } } },
        },
    },
}

export async function listAdminPosts(req, res) {
    try {
        const paging = pageParams(req.query)
        const search = searchTerm(req.query)
        const areaId = z.uuid().safeParse(req.query.areaId)

        const where = {
            status: enumFilter(POST_STATUSES, req.query.status),
            ...(areaId.success && { rescueAreaId: areaId.data }),
            ...(req.query.reported === "true" && {
                reports: { some: { status: { in: ["PENDING", "REVIEWED"] } } },
            }),
            ...(search && {
                OR: [
                    { title: { contains: search, mode: "insensitive" } },
                    { description: { contains: search, mode: "insensitive" } },
                    { creator: { name: { contains: search, mode: "insensitive" } } },
                ],
            }),
        }

        const [posts, total] = await Promise.all([
            prisma.rescuePost.findMany({
                where,
                select: adminPostSelect,
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                skip: paging.skip,
                take: paging.limit,
            }),
            prisma.rescuePost.count({ where }),
        ])

        return res.json({
            message: "Posts listed",
            data: posts,
            pagination: pageInfo(paging, total),
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch posts" });
    }
}

class PostChangedError extends Error {}

// CANCELLED is the admin take down: the post leaves the public feed but stays in
// the database so its donations and financial records are untouched (PRD §26)
export async function updatePostStatus(req, res) {
    try {
        const postId = z.uuid().safeParse(req.params.postId)
        if (!postId.success) {
            return res.status(404).json({ message: "Post not found" })
        }

        const parsed = postStatusSchema.safeParse(req.body ?? {})
        if (!parsed.success) return validationError(res, parsed)

        const { status } = parsed.data

        const post = await prisma.rescuePost.findUnique({
            where: { id: postId.data },
            select: { id: true, title: true, status: true, assignedVolunteerId: true },
        })
        if (!post) {
            return res.status(404).json({ message: "Post not found" })
        }

        if (NEEDS_VOLUNTEER.includes(status) && !post.assignedVolunteerId) {
            return res.status(400).json({ message: "This rescue has no volunteer assigned" })
        }
        if (status === "OPEN" && post.assignedVolunteerId) {
            return res.status(400).json({ message: "A rescue with a volunteer cannot be reopened" })
        }

        const { updated, refund } = await prisma.$transaction(async (tx) => {
            // only if no volunteer has claimed it since we looked; this also locks the
            // row, so no donation or assignment can land while the refund runs
            const { count } = await tx.rescuePost.updateMany({
                where: { id: post.id, assignedVolunteerId: post.assignedVolunteerId },
                data: { status },
            })
            if (count === 0) throw new PostChangedError()

            // taking a post down settles every open report on it
            const settled = status === "CANCELLED"
                ? await tx.postReport.updateMany({
                    where: { postId: post.id, status: { in: ["PENDING", "REVIEWED"] } },
                    data: { status: "RESOLVED" },
                })
                : { count: 0 }

            // only an OPEN post can be claimed, so money held by a post that leaves OPEN
            // without a volunteer would be stuck: give it back to the donors
            const refund = !post.assignedVolunteerId && status !== "OPEN"
                ? await refundHeldDonations(tx, post.id)
                : { amount: 0, count: 0 }

            await logAdminAction(tx, req.user.id, {
                action: status === "CANCELLED" ? "POST_TAKEN_DOWN" : "POST_STATUS_CHANGED",
                targetType: "RESCUE_POST",
                targetId: post.id,
                summary: status === "CANCELLED"
                    ? `Took down "${post.title}"`
                    : `Changed "${post.title}" from ${statusText(post.status)} to ${statusText(status)}`,
                details: { from: post.status, to: status, reportsResolved: settled.count, refund },
            })

            const updated = await tx.rescuePost.findUnique({ where: { id: post.id }, select: adminPostSelect })
            return { updated, refund }
        }, { maxWait: 10000, timeout: 20000 })

        const refunded = refund.count > 0
            ? ` ৳${refund.amount.toLocaleString()} refunded to ${refund.count} donation${refund.count === 1 ? "" : "s"}.`
            : ""

        return res.json({
            message: (status === "CANCELLED" ? "Post taken down." : "Post status updated.") + refunded,
            data: updated,
            refund,
        })
    } catch (error) {
        if (error instanceof PostChangedError) {
            return res.status(409).json({ message: "A volunteer just took this rescue. Refresh and try again." })
        }
        console.error(error);
        res.status(500).json({ message: "Failed to update post" });
    }
}


// ========================================
// REPORTS
// ========================================

const REPORT_STATUSES = ["PENDING", "REVIEWED", "RESOLVED", "REJECTED"]

const reportStatusSchema = z.object({
    status: z.enum(REPORT_STATUSES, "Invalid report status."),
})

const adminReportSelect = {
    id: true,
    reason: true,
    description: true,
    status: true,
    createdAt: true,
    reporter: { select: { ...publicUserSelect, email: true } },
    post: {
        select: {
            id: true,
            title: true,
            description: true,
            status: true,
            createdAt: true,
            creator: { select: { ...publicUserSelect, status: true } },
            images: { select: { id: true, imageUrl: true }, take: 1 },
            _count: { select: { reports: true } },
        },
    },
}

export async function listReports(req, res) {
    try {
        const paging = pageParams(req.query)
        const where = { status: enumFilter(REPORT_STATUSES, req.query.status) }

        const [reports, total] = await Promise.all([
            prisma.postReport.findMany({
                where,
                select: adminReportSelect,
                // oldest first so the queue is worked through in order
                orderBy: [{ createdAt: where.status === "PENDING" ? "asc" : "desc" }, { id: "asc" }],
                skip: paging.skip,
                take: paging.limit,
            }),
            prisma.postReport.count({ where }),
        ])

        return res.json({
            message: "Reports listed",
            data: reports,
            pagination: pageInfo(paging, total),
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch reports" });
    }
}

export async function updateReportStatus(req, res) {
    try {
        const reportId = z.uuid().safeParse(req.params.reportId)
        if (!reportId.success) {
            return res.status(404).json({ message: "Report not found" })
        }

        const parsed = reportStatusSchema.safeParse(req.body ?? {})
        if (!parsed.success) return validationError(res, parsed)

        const report = await prisma.$transaction(async (tx) => {
            const current = await tx.postReport.findUnique({
                where: { id: reportId.data },
                select: { id: true, status: true, reason: true, post: { select: { title: true } } },
            })
            if (!current) return null

            const report = await tx.postReport.update({
                where: { id: current.id },
                data: { status: parsed.data.status },
                select: adminReportSelect,
            })
            await logAdminAction(tx, req.user.id, {
                action: "REPORT_STATUS_CHANGED",
                targetType: "POST_REPORT",
                targetId: current.id,
                summary: `Marked a "${current.reason}" report on "${current.post.title}" as ${statusText(parsed.data.status)}`,
                details: { from: current.status, to: parsed.data.status },
            })
            return report
        })

        if (!report) {
            return res.status(404).json({ message: "Report not found" })
        }

        return res.json({ message: "Report updated", data: report })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to update report" });
    }
}


// ========================================
// RESCUE AREAS
// ========================================

const areaSchema = z.object({
    name: z.string("Area name is required.").trim().min(2, "Area name is too short.").max(100, "Area name is too long."),
})

const adminAreaSelect = {
    id: true,
    name: true,
    _count: { select: { volunteers: true, rescuePosts: true } },
}

export async function listAdminAreas(req, res) {
    try {
        const areas = await prisma.rescueArea.findMany({
            select: adminAreaSelect,
            orderBy: { name: "asc" },
        })

        return res.json({ message: "Areas listed", data: areas })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch areas" });
    }
}

export async function renameArea(req, res) {
    try {
        const areaId = z.uuid().safeParse(req.params.areaId)
        if (!areaId.success) {
            return res.status(404).json({ message: "Area not found" })
        }

        const parsed = areaSchema.safeParse(req.body ?? {})
        if (!parsed.success) return validationError(res, parsed)

        const area = await prisma.$transaction(async (tx) => {
            const current = await tx.rescueArea.findUnique({ where: { id: areaId.data }, select: { id: true, name: true } })
            if (!current) return null

            const area = await tx.rescueArea.update({
                where: { id: current.id },
                data: { name: parsed.data.name },
                select: adminAreaSelect,
            })
            await logAdminAction(tx, req.user.id, {
                action: "AREA_RENAMED",
                targetType: "RESCUE_AREA",
                targetId: current.id,
                summary: `Renamed area "${current.name}" to "${area.name}"`,
                details: { from: current.name, to: area.name },
            })
            return area
        })

        if (!area) {
            return res.status(404).json({ message: "Area not found" })
        }

        return res.json({ message: "Area renamed", data: area })
    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({ message: "Area already exists" })
        }
        console.error(error);
        res.status(500).json({ message: "Failed to rename area" });
    }
}

// Only unused areas can go; volunteers and posts point at them
export async function deleteArea(req, res) {
    try {
        const areaId = z.uuid().safeParse(req.params.areaId)
        if (!areaId.success) {
            return res.status(404).json({ message: "Area not found" })
        }

        const area = await prisma.rescueArea.findUnique({
            where: { id: areaId.data },
            select: adminAreaSelect,
        })
        if (!area) {
            return res.status(404).json({ message: "Area not found" })
        }

        if (area._count.volunteers > 0 || area._count.rescuePosts > 0) {
            return res.status(409).json({ message: "This area is in use by volunteers or posts and cannot be deleted" })
        }

        await prisma.$transaction(async (tx) => {
            await tx.rescueArea.delete({ where: { id: area.id } })
            await logAdminAction(tx, req.user.id, {
                action: "AREA_DELETED",
                targetType: "RESCUE_AREA",
                targetId: area.id,
                summary: `Deleted area "${area.name}"`,
                details: { name: area.name },
            })
        })

        return res.json({ message: "Area deleted" })
    } catch (error) {
        // a volunteer or post was added between the check and the delete
        if (error.code === "P2003") {
            return res.status(409).json({ message: "This area is in use by volunteers or posts and cannot be deleted" })
        }
        console.error(error);
        res.status(500).json({ message: "Failed to delete area" });
    }
}


// ========================================
// MARKETPLACE CATEGORIES
// ========================================

const categorySchema = z.object({
    name: z.string("Category name is required.").trim().min(2, "Category name is too short.").max(60, "Category name is too long."),
})

const adminCategorySelect = {
    id: true,
    name: true,
    _count: { select: { products: true } },
}

export async function listCategories(req, res) {
    try {
        const categories = await prisma.productCategory.findMany({
            select: adminCategorySelect,
            orderBy: { name: "asc" },
        })

        return res.json({ message: "Categories listed", data: categories })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch categories" });
    }
}

export async function createCategory(req, res) {
    try {
        const parsed = categorySchema.safeParse(req.body ?? {})
        if (!parsed.success) return validationError(res, parsed)

        const category = await prisma.$transaction(async (tx) => {
            const category = await tx.productCategory.create({
                data: { name: parsed.data.name },
                select: adminCategorySelect,
            })
            await logAdminAction(tx, req.user.id, {
                action: "CATEGORY_CREATED",
                targetType: "PRODUCT_CATEGORY",
                targetId: category.id,
                summary: `Added category "${category.name}"`,
                details: { name: category.name },
            })
            return category
        })

        return res.status(201).json({ message: "Category added", data: category })
    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({ message: "Category already exists" })
        }
        console.error(error);
        res.status(500).json({ message: "Failed to add category" });
    }
}


// ========================================
// MARKETPLACE PRODUCTS (PRD §14, §16, §28)
// ========================================

// products arrive as multipart form data, so numbers and booleans come in as strings
// (a blank field is treated as missing rather than coerced to 0)
const taka = (label, min, minMessage) => z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number(`${label} must be a number.`).int(`${label} must be a whole number.`).min(min, minMessage),
)
const boolField = z.union([z.boolean(), z.stringbool()], "Active must be true or false.")

const productFields = {
    name: z.string("Product name is required.").trim().min(2, "Product name is too short.").max(120, "Product name is too long."),
    // "" clears the description
    description: z.string().trim().max(2000, "Description is too long.").transform((d) => d || null),
    categoryId: z.uuid("Choose a category."),
    costPrice: taka("Cost price", 0, "Cost price can't be negative."),
    sellingPrice: taka("Selling price", 1, "Selling price must be at least ৳1."),
    stockQty: taka("Stock", 0, "Stock can't be negative."),
    active: boolField,
}

const createProductSchema = z.object({
    ...productFields,
    description: productFields.description.optional(),
    stockQty: productFields.stockQty.default(0),
    active: boolField.default(true),
})

const updateProductSchema = z.object(productFields).partial()

const PRODUCT_STATUSES = { active: true, inactive: false }

const adminProductSelect = {
    id: true,
    name: true,
    description: true,
    imageUrl: true,
    costPrice: true,
    sellingPrice: true,
    stockQty: true,
    active: true,
    createdAt: true,
    category: { select: { id: true, name: true } },
    _count: { select: { orderItems: true } },
}

// marketplace profit funds rescues (PRD §16), so a product may never sell at a loss
function priceError(costPrice, sellingPrice) {
    return sellingPrice < costPrice ? "Selling price can't be lower than the cost price." : null
}

async function categoryExists(categoryId) {
    const category = await prisma.productCategory.findUnique({ where: { id: categoryId }, select: { id: true } })
    return Boolean(category)
}

function uploadProductImage(file) {
    const key = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.mimetype.split("/")[1]}`
    return uploadToR2(file.buffer, key, file.mimetype)
}

export async function listAdminProducts(req, res) {
    try {
        const paging = pageParams(req.query)
        const search = searchTerm(req.query)
        const categoryId = z.uuid().safeParse(req.query.categoryId)

        const where = {
            active: PRODUCT_STATUSES[req.query.status],
            ...(categoryId.success && { categoryId: categoryId.data }),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { description: { contains: search, mode: "insensitive" } },
                ],
            }),
        }

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                select: adminProductSelect,
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                skip: paging.skip,
                take: paging.limit,
            }),
            prisma.product.count({ where }),
        ])

        return res.json({
            message: "Products listed",
            data: products,
            pagination: pageInfo(paging, total),
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch products" });
    }
}

export async function createProduct(req, res) {
    try {
        const parsed = createProductSchema.safeParse(req.body ?? {})
        if (!parsed.success) return validationError(res, parsed)

        const data = parsed.data

        const badPrice = priceError(data.costPrice, data.sellingPrice)
        if (badPrice) {
            return res.status(400).json({ message: badPrice, errors: { sellingPrice: [badPrice] } })
        }

        if (!(await categoryExists(data.categoryId))) {
            return res.status(400).json({ message: "Invalid category" })
        }

        // checked above first so a rejected request doesn't upload anything
        const imageUrl = req.file ? await uploadProductImage(req.file) : null

        const product = await prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
                data: { ...data, imageUrl },
                select: adminProductSelect,
            })
            await logAdminAction(tx, req.user.id, {
                action: "PRODUCT_CREATED",
                targetType: "PRODUCT",
                targetId: product.id,
                summary: `Added product "${product.name}"`,
                details: { ...data, imageUrl },
            })
            return product
        })

        return res.status(201).json({ message: "Product added", data: product })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to add product" });
    }
}

// Edits any field, including active. Products are deactivated instead of deleted
// because past orders point at them.
export async function updateProduct(req, res) {
    try {
        const productId = z.uuid().safeParse(req.params.productId)
        if (!productId.success) {
            return res.status(404).json({ message: "Product not found" })
        }

        const parsed = updateProductSchema.safeParse(req.body ?? {})
        if (!parsed.success) return validationError(res, parsed)

        const data = parsed.data

        const product = await prisma.product.findUnique({
            where: { id: productId.data },
            select: {
                id: true, name: true, description: true, imageUrl: true, categoryId: true,
                costPrice: true, sellingPrice: true, stockQty: true, active: true,
            },
        })
        if (!product) {
            return res.status(404).json({ message: "Product not found" })
        }

        const badPrice = priceError(data.costPrice ?? product.costPrice, data.sellingPrice ?? product.sellingPrice)
        if (badPrice) {
            return res.status(400).json({ message: badPrice, errors: { sellingPrice: [badPrice] } })
        }

        if (data.categoryId && !(await categoryExists(data.categoryId))) {
            return res.status(400).json({ message: "Invalid category" })
        }

        const imageUrl = req.file ? await uploadProductImage(req.file) : undefined

        const onlyActive = Object.keys(data).length === 1 && data.active !== undefined
        const message = onlyActive
            ? (data.active ? "Product activated" : "Product deactivated")
            : "Product updated"

        const updated = await prisma.$transaction(async (tx) => {
            const updated = await tx.product.update({
                where: { id: product.id },
                data: { ...data, imageUrl },
                select: adminProductSelect,
            })
            await logAdminAction(tx, req.user.id, {
                action: "PRODUCT_UPDATED",
                targetType: "PRODUCT",
                targetId: product.id,
                summary: onlyActive
                    ? `${data.active ? "Activated" : "Deactivated"} product "${product.name}"`
                    : `Updated product "${product.name}"`,
                details: { changes: changedFields(product, { ...data, imageUrl }) },
            })
            return updated
        })

        return res.json({ message, data: updated })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to update product" });
    }
}


// ========================================
// MARKETPLACE ORDERS (PRD §15, §22)
// ========================================

const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]
const PAYMENT_METHODS = ["CASH", "BKASH", "NAGAD", "CARD", "BANK_TRANSFER", "WALLET", "OTHER"]

// orders only move forward, and can be cancelled until they are delivered
const ORDER_FLOW = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["PROCESSING", "CANCELLED"],
    PROCESSING: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED", "CANCELLED"],
}

const orderStatusSchema = z.object({
    status: z.enum(["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"], "Invalid order status."),
})

const adminOrderSelect = {
    id: true,
    totalAmount: true,
    paymentMethod: true,
    status: true,
    deliveryName: true,
    deliveryPhone: true,
    deliveryAddress: true,
    createdAt: true,
    buyer: { select: { ...publicUserSelect, email: true, phone: true } },
    payment: { select: { status: true } },
    items: {
        select: {
            id: true,
            quantity: true,
            unitPrice: true,
            product: { select: { id: true, name: true, imageUrl: true } },
        },
    },
}

class OrderConflictError extends Error {}

// order numbers are the first 8 characters of the id, which Prisma can't prefix
// match on a uuid column, so look those up directly
async function orderIdsByNumber(search) {
    const number = search.replace(/^#/, "")
    if (!/^[0-9a-f]{4,8}$/i.test(number)) return []
    const rows = await prisma.$queryRaw`
        SELECT id FROM orders WHERE id::text ILIKE ${`${number.toLowerCase()}%`} LIMIT 100
    `
    return rows.map((row) => row.id)
}

export async function listOrders(req, res) {
    try {
        const paging = pageParams(req.query)
        const search = searchTerm(req.query)
        const status = enumFilter(ORDER_STATUSES, req.query.status)
        const ids = search ? await orderIdsByNumber(search) : []

        // everything but the status, so the status chips can show their counts
        const baseWhere = {
            paymentMethod: enumFilter(PAYMENT_METHODS, req.query.paymentMethod),
            ...(search && {
                OR: [
                    { id: { in: ids } },
                    { buyer: { name: { contains: search, mode: "insensitive" } } },
                    { buyer: { email: { contains: search, mode: "insensitive" } } },
                    { deliveryName: { contains: search, mode: "insensitive" } },
                    { deliveryPhone: { contains: search } },
                ],
            }),
        }
        const where = { ...baseWhere, status }

        const [orders, total, byStatus] = await Promise.all([
            prisma.order.findMany({
                where,
                select: adminOrderSelect,
                // pending orders are a queue, so the oldest comes first
                orderBy: [{ createdAt: status === "PENDING" ? "asc" : "desc" }, { id: "asc" }],
                skip: paging.skip,
                take: paging.limit,
            }),
            prisma.order.count({ where }),
            prisma.order.groupBy({ by: ["status"], where: baseWhere, _count: true }),
        ])

        return res.json({
            message: "Orders listed",
            data: orders,
            counts: Object.fromEntries(byStatus.map((row) => [row.status, row._count])),
            pagination: pageInfo(paging, total),
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch orders" });
    }
}

// Delivering a cash order means the courier collected the money, so the sale
// counts from then on. Cancelling puts the items back in stock and refunds a
// wallet payment through the ledger (PRD §27, §40).
export async function updateOrderStatus(req, res) {
    try {
        const orderId = z.uuid().safeParse(req.params.orderId)
        if (!orderId.success) {
            return res.status(404).json({ message: "Order not found" })
        }

        const parsed = orderStatusSchema.safeParse(req.body ?? {})
        if (!parsed.success) return validationError(res, parsed)

        const { status } = parsed.data

        const order = await prisma.order.findUnique({
            where: { id: orderId.data },
            select: {
                id: true,
                status: true,
                buyerId: true,
                paymentId: true,
                totalAmount: true,
                payment: { select: { status: true } },
                buyer: { select: { wallet: { select: { id: true } } } },
                financialTransaction: { select: { relatedVolunteerId: true } },
                // same lock order as checkout, so a cancel and a checkout can't deadlock
                items: {
                    select: { productId: true, quantity: true, unitPrice: true, unitCost: true },
                    orderBy: { productId: "asc" },
                },
            },
        })
        if (!order) {
            return res.status(404).json({ message: "Order not found" })
        }

        if (!ORDER_FLOW[order.status]?.includes(status)) {
            return res.status(400).json({
                message: `A ${order.status.toLowerCase()} order can't be marked ${status.toLowerCase()}`,
            })
        }

        const number = orderNumber(order.id)
        const refunded = status === "CANCELLED" && order.payment.status === "COMPLETED"

        const updated = await prisma.$transaction(async (tx) => {
            // only moves the order if nobody else has since, so two admins can't
            // both cancel it and refund it twice
            const { count } = await tx.order.updateMany({
                where: { id: order.id, status: order.status },
                data: { status },
            })
            if (count === 0) throw new OrderConflictError()

            if (status === "DELIVERED" && order.payment.status === "PENDING") {
                await tx.payment.update({ where: { id: order.paymentId }, data: { status: "COMPLETED" } })
                await tx.financialTransaction.updateMany({
                    where: { relatedOrderId: order.id, status: "PENDING" },
                    data: { status: "COMPLETED" },
                })
            }

            // a delivered order is a final sale, so its profit goes into the PawAid Fund.
            // DELIVERED can only be reached once (the claim above), so it is never paid twice
            let profit = 0
            if (status === "DELIVERED") {
                profit = order.items.reduce(
                    (sum, item) => sum + Math.max(item.unitPrice - item.unitCost, 0) * item.quantity,
                    0,
                )
                if (profit > 0) {
                    await tx.financialTransaction.create({
                        data: {
                            type: "MARKETPLACE_PROFIT",
                            source: "MARKETPLACE",
                            destination: "PAWAID_FUND",
                            amount: profit,
                            rescueFundId: PAWAID_FUND_ID,
                            status: "COMPLETED",
                            reference: `Profit from order #${number}`,
                        },
                    })
                    await creditFund(tx, profit)
                }
            }

            if (status === "CANCELLED") {
                for (const { productId, quantity } of order.items) {
                    await tx.product.update({ where: { id: productId }, data: { stockQty: { increment: quantity } } })
                }

                if (refunded) {
                    // the payment row stays as it was; the refund is its own ledger entry
                    const refund = await tx.financialTransaction.create({
                        data: {
                            type: "REFUND",
                            source: "MARKETPLACE",
                            destination: "WALLET",
                            amount: order.totalAmount,
                            relatedUserId: order.buyerId,
                            relatedVolunteerId: order.financialTransaction?.relatedVolunteerId ?? null,
                            paymentId: order.paymentId,
                            status: "COMPLETED",
                            reference: `Refund for order #${number}`,
                        },
                    })
                    await creditWallet(tx, {
                        walletId: order.buyer.wallet.id,
                        amount: order.totalAmount,
                        transactionId: refund.id,
                        reference: `Refund for cancelled order #${number}`,
                    })
                    await tx.payment.update({ where: { id: order.paymentId }, data: { status: "REFUNDED" } })
                } else {
                    // cash that was never collected
                    await tx.payment.update({ where: { id: order.paymentId }, data: { status: "FAILED" } })
                    await tx.financialTransaction.updateMany({
                        where: { relatedOrderId: order.id, status: "PENDING" },
                        data: { status: "CANCELLED" },
                    })
                }
            }

            await logAdminAction(tx, req.user.id, {
                action: "ORDER_STATUS_CHANGED",
                targetType: "ORDER",
                targetId: order.id,
                summary: `Changed order #${number} from ${statusText(order.status)} to ${statusText(status)}`,
                details: {
                    from: order.status,
                    to: status,
                    ...(profit > 0 && { profitToFund: profit }),
                    ...(refunded && { refundedToWallet: order.totalAmount }),
                },
            })

            return tx.order.findUnique({ where: { id: order.id }, select: adminOrderSelect })
        }, { maxWait: 10000, timeout: 20000 })

        return res.json({
            message: refunded ? "Order cancelled and refunded to the buyer's wallet" : `Order #${number} updated`,
            data: updated,
        })
    } catch (error) {
        if (error instanceof OrderConflictError) {
            return res.status(409).json({ message: "This order was just updated by someone else. Refresh and try again." })
        }
        console.error(error);
        res.status(500).json({ message: "Failed to update order" });
    }
}


// ========================================
// FINANCIAL TRANSACTIONS (read only, PRD §27)
// ========================================

const TRANSACTION_TYPES = [
    "INCOME", "EXPENSE", "TRANSFER", "DONATION", "ORDER_PAYMENT", "REFUND", "MARKETPLACE_PROFIT", "RESCUE_FUND_ALLOCATION",
]

export async function listTransactions(req, res) {
    try {
        const paging = pageParams(req.query)
        const where = { type: enumFilter(TRANSACTION_TYPES, req.query.type) }

        const [transactions, total, totals] = await Promise.all([
            prisma.financialTransaction.findMany({
                where,
                select: {
                    id: true,
                    type: true,
                    source: true,
                    destination: true,
                    amount: true,
                    status: true,
                    reference: true,
                    createdAt: true,
                    relatedUser: { select: publicUserSelect },
                    relatedVolunteer: { select: { id: true, user: { select: publicUserSelect } } },
                    relatedPost: { select: { id: true, title: true } },
                    payment: { select: { method: true } },
                },
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                skip: paging.skip,
                take: paging.limit,
            }),
            prisma.financialTransaction.count({ where }),
            prisma.financialTransaction.groupBy({
                by: ["type"],
                where: { status: "COMPLETED" },
                _sum: { amount: true },
                _count: true,
            }),
        ])

        return res.json({
            message: "Transactions listed",
            data: transactions,
            totals: totals.map((t) => ({ type: t.type, amount: t._sum.amount ?? 0, count: t._count })),
            pagination: pageInfo(paging, total),
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch transactions" });
    }
}


// ========================================
// AUDIT LOG (read only, PRD §39)
// ========================================

const ADMIN_ACTIONS = [
    "USER_SUSPENDED", "USER_REACTIVATED", "VOLUNTEER_REVOKED", "VOLUNTEER_RESTORED", "POST_STATUS_CHANGED",
    "POST_TAKEN_DOWN", "REPORT_STATUS_CHANGED", "AREA_CREATED", "AREA_RENAMED", "AREA_DELETED", "CATEGORY_CREATED",
    "PRODUCT_CREATED", "PRODUCT_UPDATED", "ORDER_STATUS_CHANGED", "FUND_DONATION",
]
const AUDIT_TARGET_TYPES = [
    "USER", "VOLUNTEER", "RESCUE_POST", "POST_REPORT", "RESCUE_AREA", "PRODUCT_CATEGORY", "PRODUCT", "ORDER", "DONATION",
]

export async function listAuditLogs(req, res) {
    try {
        const paging = pageParams(req.query)
        const search = searchTerm(req.query)
        const adminId = z.uuid().safeParse(req.query.adminId)
        const targetId = z.uuid().safeParse(req.query.targetId)

        const where = {
            action: enumFilter(ADMIN_ACTIONS, req.query.action),
            targetType: enumFilter(AUDIT_TARGET_TYPES, req.query.targetType),
            ...(adminId.success && { adminId: adminId.data }),
            ...(targetId.success && { targetId: targetId.data }),
            ...(search && {
                OR: [
                    { summary: { contains: search, mode: "insensitive" } },
                    { admin: { name: { contains: search, mode: "insensitive" } } },
                ],
            }),
        }

        const [logs, total] = await Promise.all([
            prisma.adminAuditLog.findMany({
                where,
                select: {
                    id: true,
                    action: true,
                    targetType: true,
                    targetId: true,
                    summary: true,
                    details: true,
                    createdAt: true,
                    admin: { select: { ...publicUserSelect, email: true } },
                },
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                skip: paging.skip,
                take: paging.limit,
            }),
            prisma.adminAuditLog.count({ where }),
        ])

        return res.json({
            message: "Audit log listed",
            data: logs,
            pagination: pageInfo(paging, total),
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch the audit log" });
    }
}
