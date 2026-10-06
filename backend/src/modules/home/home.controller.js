import { prisma } from "../../db.js";

const publicUserSelect = { id: true, name: true, profilePictureUrl: true };
const activeVolunteer = { status: "ACTIVE", user: { status: "ACTIVE" } };


// Everything the homepage sidebars show: platform totals, this month's top
// volunteers, volunteers to discover and (when signed in) the viewer's own numbers
export async function homeSummary(req, res) {
  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const userId = req.user?.id

    const viewerVolunteer = userId
      ? await prisma.volunteerProfile.findUnique({
          where: { userId },
          select: { id: true, status: true, rescueAreaId: true, rescueArea: true, description: true },
        })
      : null

    const [monthDonations, allDonations, rescuesFunded, rescuesResolved, topGroups, discover] =
      await Promise.all([
        prisma.donation.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { amount: true } }),
        prisma.donation.aggregate({ _sum: { amount: true } }),
        prisma.rescuePost.count({ where: { donationReceived: { gt: 0 } } }),
        prisma.rescuePost.count({ where: { status: "RESOLVED" } }),
        prisma.donation.groupBy({
          by: ["volunteerId"],
          where: { createdAt: { gte: monthStart }, volunteerId: { not: null }, volunteer: activeVolunteer },
          _sum: { amount: true },
          orderBy: { _sum: { amount: "desc" } },
          take: 3,
        }),
        // volunteers in the viewer's own area when they have one, newest otherwise
        prisma.volunteerProfile.findMany({
          where: {
            ...activeVolunteer,
            ...(viewerVolunteer && {
              rescueAreaId: viewerVolunteer.rescueAreaId,
              id: { not: viewerVolunteer.id },
            }),
          },
          select: { id: true, description: true, rescueArea: true, user: { select: publicUserSelect } },
          orderBy: { createdAt: "desc" },
          take: 3,
        }),
      ])

    const topIds = topGroups.map((g) => g.volunteerId)
    const [topProfiles, topRescueCounts] = await Promise.all([
      prisma.volunteerProfile.findMany({
        where: { id: { in: topIds } },
        select: { id: true, user: { select: publicUserSelect } },
      }),
      prisma.rescuePost.groupBy({
        by: ["assignedVolunteerId"],
        where: { assignedVolunteerId: { in: topIds } },
        _count: true,
      }),
    ])

    const topVolunteers = topGroups.map((g) => ({
      ...topProfiles.find((p) => p.id === g.volunteerId),
      raised: g._sum.amount ?? 0,
      rescues: topRescueCounts.find((c) => c.assignedVolunteerId === g.volunteerId)?._count ?? 0,
    }))

    return res.json({
      message: "Home summary",
      data: {
        pool: {
          donationsThisMonth: monthDonations._sum.amount ?? 0,
          totalDonated: allDonations._sum.amount ?? 0,
          rescuesFunded,
          rescuesResolved,
        },
        topVolunteers,
        discover: {
          inYourArea: Boolean(viewerVolunteer),
          areaName: viewerVolunteer?.rescueArea?.name ?? null,
          volunteers: discover,
        },
        me: userId ? await viewerSummary(userId, viewerVolunteer) : null,
      },
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch home summary" });
  }
}


async function viewerSummary(userId, volunteer) {
  const [wallet, postCount, donated, received, spent, assignedCount] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId }, select: { balance: true } }),
    prisma.rescuePost.count({ where: { creatorId: userId } }),
    prisma.donation.aggregate({ where: { donorId: userId }, _sum: { amount: true }, _count: true }),
    volunteer
      ? prisma.donation.aggregate({ where: { volunteerId: volunteer.id }, _sum: { amount: true } })
      : null,
    volunteer
      ? prisma.walletTransaction.aggregate({
          where: { type: "DEBIT", wallet: { userId } },
          _sum: { amount: true },
        })
      : null,
    volunteer ? prisma.rescuePost.count({ where: { assignedVolunteerId: volunteer.id } }) : 0,
  ])

  return {
    walletBalance: wallet?.balance ?? 0,
    postCount,
    donatedTotal: donated._sum.amount ?? 0,
    donationCount: donated._count,
    volunteer: volunteer && {
      id: volunteer.id,
      status: volunteer.status,
      description: volunteer.description,
      areaName: volunteer.rescueArea?.name ?? null,
      donationsReceived: received?._sum.amount ?? 0,
      totalSpent: spent?._sum.amount ?? 0,
      assignedCount,
    },
  }
}
