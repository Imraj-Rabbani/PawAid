import { prisma } from "../../db.js";

const volunteerInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      profilePictureUrl: true,
      address: true,
      phone: true,
    },
  },
  rescueArea: true,
};


// Public listing: never expose nid, contact details or wallet here
const publicVolunteerSelect = {
  id: true,
  description: true,
  status: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
      profilePictureUrl: true,
    },
  },
  rescueArea: true,
};


export async function volunteers(req, res) {
  try {
    const allVolunteers = await prisma.volunteerProfile.findMany({
      where: {
        status: { notIn: ["INACTIVE", "SUSPENDED"] }
      }, select: publicVolunteerSelect,
      orderBy: { createdAt: "desc" }
    })

    return res.json({
      message: "Successfully sent the volunteers",
      data: allVolunteers
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch volunteers" });
  }
}


export async function volunteerById(req, res) {
  try {
    const { id } = req.params

    // a malformed id makes the lookup throw, treat it the same as a missing volunteer
    const profile = await prisma.volunteerProfile.findUnique({
      where: { id },
      select: {
        ...publicVolunteerSelect,
        user: {
          select: {
            ...publicVolunteerSelect.user.select,
            createdAt: true,
            // Wallet history is public for transparency, but never who the money came from
            wallet: {
              select: {
                balance: true,
                transactions: {
                  select: {
                    id: true,
                    amount: true,
                    type: true,
                    reference: true,
                    createdAt: true,
                    relatedTransaction: {
                      select: {
                        source: true,
                        destination: true,
                        relatedPost: { select: { id: true, title: true } },
                      },
                    },
                  },
                  orderBy: { createdAt: "desc" },
                  take: 20,
                },
              },
            },
          },
        },
        assignedPosts: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            rescueArea: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    }).catch(() => null)

    if (!profile || ["INACTIVE", "SUSPENDED"].includes(profile.status)) {
      return res.status(404).json({ message: "Volunteer not found" })
    }

    const [totalRescues, resolvedRescues, walletTotals, donations] = await Promise.all([
      prisma.rescuePost.count({ where: { assignedVolunteerId: id } }),
      prisma.rescuePost.count({ where: { assignedVolunteerId: id, status: "RESOLVED" } }),
      prisma.walletTransaction.groupBy({
        by: ["type"],
        where: { wallet: { userId: profile.user.id } },
        _sum: { amount: true },
      }),
      prisma.donation.aggregate({
        where: { volunteerId: id },
        _sum: { amount: true },
        _count: true,
      }),
    ])

    const sumOf = (type) => walletTotals.find((t) => t.type === type)?._sum.amount ?? 0

    const { wallet, ...user } = profile.user

    return res.json({
      message: "Successfully sent the volunteer",
      data: {
        ...profile,
        user,
        wallet: wallet && {
          ...wallet,
          totalReceived: sumOf("CREDIT"),
          totalSpent: sumOf("DEBIT"),
        },
        stats: {
          totalRescues,
          resolvedRescues,
          donationsReceived: donations._sum.amount ?? 0,
          donationCount: donations._count,
        },
      },
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch volunteer" });
  }
}


export async function volunteerApplication(req, res) {
  try {
    const userId = req.user.id
    const { rescueAreaId, phone, address, profilePictureUrl, description } = req.body
    const nid = typeof req.body.nid === "string" ? req.body.nid.trim() : ""

    if (!rescueAreaId || !nid) {
      return res.status(400).json({ message: "rescueAreaId and nid are required" })
    }

    if (req.user.role === "VOLUNTEER") {
      return res.status(409).json({ message: `${req.user.name} is already a volunteer` })
    }

    if (req.user.role !== "USER") {
      return res.status(403).json({ message: "Only normal users can apply to be a volunteer" })
    }

    // a malformed id makes the lookup throw, treat it the same as a missing area
    const area = await prisma.rescueArea.findUnique({ where: { id: rescueAreaId } }).catch(() => null)
    if (!area) {
      return res.status(400).json({ message: "Invalid rescue area" })
    }

    const result = await prisma.$transaction(async (tx) => {
      const profile = await tx.volunteerProfile.create({
        data: {
          userId,
          rescueAreaId,
          nid,
          description: description || null,
          status: "ACTIVE",
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          role: "VOLUNTEER",
          phone: phone || undefined,
          address: address || undefined,
          profilePictureUrl: profilePictureUrl || undefined,
        },
      });

      return tx.volunteerProfile.findUnique({
        where: { id: profile.id },
        include: volunteerInclude,
      });
    });

    return res.status(201).json(result)
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "NID already registered" })
    }
    if (error.code === "P2003") {
      return res.status(400).json({ message: "Invalid rescue area" })
    }
    console.error(error)
    return res.status(500).json({ message: "Failed to submit volunteer application" })
  }
}


export async function volunteer(req, res) {

  try {
    const userId = req.user.id

    const volunteer = await prisma.volunteerProfile.findUnique({
      where: { userId: userId },
      include: volunteerInclude
    })

    if (!volunteer) {
      return res.status(404).json({ message: "Volunteer profile not found" });
    }

    return res.json(volunteer)
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch volunteer" });
  }
}


export async function updateVolunteerProfile(req, res){
  try {
    const userId = req.user.id;
    const { rescueAreaId, nid, description } = req.body;

    if (rescueAreaId) {
      const area = await prisma.rescueArea.findUnique({ where: { id: rescueAreaId } }).catch(() => null);
      if (!area) return res.status(400).json({ message: "Invalid rescue area" });
    }

    const profile = await prisma.volunteerProfile.update({
      where: { userId },
      data: {
        ...(rescueAreaId && { rescueAreaId }),
        ...(nid && { nid }),
        ...(description !== undefined && { description }),
      },
      include: { rescueArea: true },
    });

    res.json(profile);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "NID already registered" });
    }
    if (error.code === "P2003") {
      return res.status(400).json({ message: "Invalid rescue area" });
    }
    console.error(error);
    res.status(500).json({ message: "Failed to update volunteer information" });
  }

}