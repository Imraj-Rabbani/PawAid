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
  wallet: true,
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

      await tx.wallet.create({
        data: {
          volunteerId: profile.id,
          balance: 0,
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

    const existing = await prisma.volunteerProfile.findUnique({ where: { userId } });
    if (!existing) return res.status(404).json({ message: "Volunteer profile not found" });

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