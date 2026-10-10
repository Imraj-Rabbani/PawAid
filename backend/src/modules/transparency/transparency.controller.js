import { prisma } from "../../db.js";

// orders that have been paid for and not cancelled or refunded count as sales
const SOLD_ORDER_STATUSES = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];


// Public financial overview (PRD §19, §41). Aggregates only: nothing here may
// identify an individual donor. Money figures come from the ledger
// (FinancialTransaction), not cached counters, so they always reconcile (PRD §31).
export async function transparencyOverview(req, res) {
  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const completed = { status: "COMPLETED" }

    const [
      donations, monthDonations, donationsByDestination, donors, topUps,
      movedFromRescues, heldForRescues, volunteerWallets, activeVolunteers,
      postsByStatus, fundedRescues,
      products, revenue, profitRows, rescueFund,
    ] = await Promise.all([
      prisma.financialTransaction.aggregate({ where: { ...completed, type: "DONATION" }, _sum: { amount: true }, _count: true }),
      prisma.financialTransaction.aggregate({
        where: { ...completed, type: "DONATION", createdAt: { gte: monthStart } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.donation.groupBy({ by: ["destinationType"], _sum: { amount: true } }),
      // a count of distinct donors, never who they are
      prisma.donation.groupBy({ by: ["donorId"] }).then((rows) => rows.length),
      prisma.financialTransaction.aggregate({ where: { ...completed, source: "TOP_UP" }, _sum: { amount: true } }),
      // money a rescue raised before a volunteer took it, then handed to them
      prisma.financialTransaction.aggregate({
        where: { ...completed, type: "TRANSFER", source: "RESCUE_POST" },
        _sum: { amount: true },
      }),
      // raised by rescues nobody has taken on yet, waiting for a volunteer
      prisma.rescuePost.aggregate({ where: { assignedVolunteerId: null }, _sum: { donationReceived: true } }),
      prisma.wallet.aggregate({ where: { user: { volunteerProfile: { isNot: null } } }, _sum: { balance: true } }),
      prisma.volunteerProfile.count({ where: { status: "ACTIVE", user: { status: "ACTIVE" } } }),
      prisma.rescuePost.groupBy({ by: ["status"], where: { status: { not: "CANCELLED" } }, _count: true }),
      prisma.rescuePost.count({ where: { donationReceived: { gt: 0 }, status: { not: "CANCELLED" } } }),
      prisma.product.count({ where: { active: true } }),
      prisma.financialTransaction.aggregate({ where: { ...completed, type: "ORDER_PAYMENT" }, _sum: { amount: true } }),
      // profit is per item: what it sold for minus what it cost, for every sold order
      prisma.$queryRaw`
        SELECT COALESCE(SUM((oi.unit_price - p.cost_price) * oi.quantity), 0)::int AS profit
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        WHERE o.status::text = ANY(${SOLD_ORDER_STATUSES})
      `,
      // total_available is everything the fund has received, total_used what it has paid out
      prisma.rescueFund.aggregate({ _sum: { totalAvailable: true, totalUsed: true } }),
    ])

    const byDestination = (type) =>
      donationsByDestination.find((d) => d.destinationType === type)?._sum.amount ?? 0
    const postCount = (status) => postsByStatus.find((p) => p.status === status)?._count ?? 0

    const fundTotal = rescueFund._sum.totalAvailable ?? 0
    const fundUsed = rescueFund._sum.totalUsed ?? 0
    const directToVolunteers = byDestination("VOLUNTEER")

    return res.json({
      message: "Transparency overview",
      data: {
        donations: {
          total: donations._sum.amount ?? 0,
          count: donations._count,
          thisMonth: monthDonations._sum.amount ?? 0,
          countThisMonth: monthDonations._count,
          donors,
          toRescues: byDestination("RESCUE_POST"),
          toVolunteers: directToVolunteers,
          averageDonation: donations._count ? Math.round((donations._sum.amount ?? 0) / donations._count) : 0,
        },
        walletTopUps: topUps._sum.amount ?? 0,
        volunteers: {
          active: activeVolunteers,
          fundsHeld: volunteerWallets._sum.balance ?? 0,
          movedFromRescues: movedFromRescues._sum.amount ?? 0,
          heldForUnassignedRescues: heldForRescues._sum.donationReceived ?? 0,
        },
        rescues: {
          total: postsByStatus.reduce((sum, p) => sum + p._count, 0),
          awaitingVolunteer: postCount("OPEN"),
          inProgress: postCount("ASSIGNED") + postCount("IN_PROGRESS"),
          rescued: postCount("RESOLVED"),
          funded: fundedRescues,
        },
        marketplace: {
          live: products > 0,
          revenue: revenue._sum.amount ?? 0,
          profit: profitRows[0]?.profit ?? 0,
        },
        rescueFund: {
          contributed: fundTotal,
          used: fundUsed,
          remaining: fundTotal - fundUsed,
        },
        generatedAt: now,
      },
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load the financial overview" });
  }
}
