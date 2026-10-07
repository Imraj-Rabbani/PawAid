import z from "zod";
import { prisma } from "../../db.js"

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
            reportsByStatus, areas, donations, monthDonations, topUps, walletTotal,
        ] = await Promise.all([
            prisma.user.groupBy({ by: ["role"], _count: true }),
            prisma.user.groupBy({ by: ["status"], _count: true }),
            prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
            prisma.volunteerProfile.groupBy({ by: ["status"], _count: true }),
            prisma.rescuePost.groupBy({ by: ["status"], _count: true }),
            prisma.postReport.groupBy({ by: ["status"], _count: true }),
            prisma.rescueArea.count(),
            prisma.donation.aggregate({ _sum: { amount: true }, _count: true }),
            prisma.donation.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { amount: true }, _count: true }),
            prisma.financialTransaction.aggregate({
                where: { source: "TOP_UP", status: "COMPLETED" },
                _sum: { amount: true },
            }),
            prisma.wallet.aggregate({ _sum: { balance: true } }),
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
            select: { id: true, role: true },
        })
        if (!user) {
            return res.status(404).json({ message: "User not found" })
        }

        if (user.role === "ADMIN") {
            return res.status(403).json({ message: "Admins cannot be suspended" })
        }

        const updated = await prisma.user.update({
            where: { id: user.id },
            data: { status: parsed.data.status },
            select: adminUserSelect,
        })

        return res.json({
            message: parsed.data.status === "SUSPENDED" ? "User suspended" : "User reactivated",
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

        const volunteer = await prisma.volunteerProfile.update({
            where: { id: volunteerId.data },
            data: { status: parsed.data.status },
            select: adminVolunteerSelect,
        }).catch((error) => {
            if (error.code === "P2025") return null
            throw error
        })

        if (!volunteer) {
            return res.status(404).json({ message: "Volunteer not found" })
        }

        return res.json({
            message: parsed.data.status === "SUSPENDED" ? "Volunteer status revoked" : "Volunteer status restored",
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
            select: { id: true, assignedVolunteerId: true },
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

        const updated = await prisma.$transaction(async (tx) => {
            // taking a post down settles every open report on it
            if (status === "CANCELLED") {
                await tx.postReport.updateMany({
                    where: { postId: post.id, status: { in: ["PENDING", "REVIEWED"] } },
                    data: { status: "RESOLVED" },
                })
            }

            return tx.rescuePost.update({
                where: { id: post.id },
                data: { status },
                select: adminPostSelect,
            })
        })

        return res.json({
            message: status === "CANCELLED" ? "Post taken down" : "Post status updated",
            data: updated,
        })
    } catch (error) {
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

        const report = await prisma.postReport.update({
            where: { id: reportId.data },
            data: { status: parsed.data.status },
            select: adminReportSelect,
        }).catch((error) => {
            if (error.code === "P2025") return null
            throw error
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

        const area = await prisma.rescueArea.update({
            where: { id: areaId.data },
            data: { name: parsed.data.name },
            select: adminAreaSelect,
        })

        return res.json({ message: "Area renamed", data: area })
    } catch (error) {
        if (error.code === "P2002") {
            return res.status(409).json({ message: "Area already exists" })
        }
        if (error.code === "P2025") {
            return res.status(404).json({ message: "Area not found" })
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

        await prisma.rescueArea.delete({ where: { id: area.id } })

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
// FINANCIAL TRANSACTIONS (read only, PRD §27)
// ========================================

const TRANSACTION_TYPES = ["INCOME", "EXPENSE", "TRANSFER", "DONATION", "ORDER_PAYMENT", "REFUND"]

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
