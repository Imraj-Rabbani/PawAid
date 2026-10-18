import { prisma } from "../../db.js";

// donations made by people, as opposed to by the PawAid Fund
const fromCommunity = { donorId: { not: null } };


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
      postsByStatus, fundedRescues, expenses,
      products, revenue, refunds, profit, fundGiven, fundByDestination, fundRecent,
    ] = await Promise.all([
      prisma.financialTransaction.aggregate({ where: { ...completed, type: "DONATION" }, _sum: { amount: true }, _count: true }),
      prisma.financialTransaction.aggregate({
        where: { ...completed, type: "DONATION", createdAt: { gte: monthStart } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.donation.groupBy({ by: ["destinationType"], where: fromCommunity, _sum: { amount: true } }),
      // a count of distinct donors, never who they are
      prisma.donation.groupBy({ by: ["donorId"], where: fromCommunity }).then((rows) => rows.length),
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
      // what volunteers have documented spending on rescues, with receipts or orders (PRD §21)
      prisma.rescueExpense.aggregate({ _sum: { amount: true }, _count: true }),
      prisma.product.count({ where: { active: true } }),
      prisma.financialTransaction.aggregate({ where: { ...completed, type: "ORDER_PAYMENT" }, _sum: { amount: true } }),
      // cancelled orders paid from a wallet are refunded, and stop counting as revenue
      prisma.financialTransaction.aggregate({
        where: { ...completed, type: "REFUND", source: "MARKETPLACE" },
        _sum: { amount: true },
      }),
      // profit is posted to the PawAid Fund once an order is delivered
      prisma.financialTransaction.aggregate({
        where: { ...completed, type: "MARKETPLACE_PROFIT" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.financialTransaction.aggregate({
        where: { ...completed, type: "RESCUE_FUND_ALLOCATION" },
        _sum: { amount: true },
        _count: true,
      }),
      // what the admin chose to give to; a rescue's money still reaches its volunteer
      prisma.donation.groupBy({ by: ["destinationType"], where: { rescueFundId: { not: null } }, _sum: { amount: true } }),
      // the fund is the donor here, so naming who received it identifies no one's giving
      prisma.donation.findMany({
        where: { rescueFundId: { not: null } },
        select: {
          id: true,
          amount: true,
          destinationType: true,
          createdAt: true,
          rescuePost: { select: { id: true, title: true } },
          volunteer: { select: { id: true, user: { select: { id: true, name: true, profilePictureUrl: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ])

    const byDestination = (type) =>
      donationsByDestination.find((d) => d.destinationType === type)?._sum.amount ?? 0
    const postCount = (status) => postsByStatus.find((p) => p.status === status)?._count ?? 0

    const fundIn = profit._sum.amount ?? 0
    const fundOut = fundGiven._sum.amount ?? 0
    const fundGivenTo = (type) => fundByDestination.find((d) => d.destinationType === type)?._sum.amount ?? 0
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
          documentedExpenses: expenses._sum.amount ?? 0,
          expenseCount: expenses._count,
        },
        marketplace: {
          live: products > 0,
          revenue: (revenue._sum.amount ?? 0) - (refunds._sum.amount ?? 0),
          profit: fundIn,
          deliveredOrders: profit._count,
        },
        pawaidFund: {
          received: fundIn,
          donated: fundOut,
          balance: fundIn - fundOut,
          toVolunteers: fundGivenTo("VOLUNTEER"),
          toRescues: fundGivenTo("RESCUE_POST"),
          donationCount: fundGiven._count,
          recent: fundRecent,
        },
        generatedAt: now,
      },
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to load the financial overview" });
  }
}
