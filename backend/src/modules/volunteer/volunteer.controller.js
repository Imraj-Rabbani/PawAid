import { prisma } from "../../db";

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


export async function volunteers(req, res){
    try {
        const activeVolunteers = await prisma.volunteerProfile.findMany({
            where:{
                status: VolunteerStatus.ACTIVE
            }, include: volunteerInclude,
            orderBy: {createdAt: "desc"}
        })
    
        return res.json({
            message: "Successfully sent the volunteers",
            data: activeVolunteers
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to fetch volunteers" });
    }  
}


export async function volunteerApplication(req, res) {
    try {
      const { userId, rescueAreaId, phone, address, profilePictureUrl, nid, description } = req.body
  
      if (!rescueAreaId || !nid) {
        return res.status(400).json({ message: "rescueAreaId and nid are required" })
      }
  
      const user = await prisma.user.findUnique({ where: { id: userId } })
  
      if (!user) {
        return res.status(404).json({ message: "User not found." })
      }
  
      if (user.role === "VOLUNTEER") {
        return res.status(409).json({ message: `${user.name} is already a volunteer` })
      }
  
      const result = await prisma.$transaction(async (tx) => {
        const profile = await tx.volunteerProfile.create({
          data: {
            userId,
            rescueAreaId,
            nid,
            description: description || null,
            status: "PENDING",
          },
        });
  
        await tx.wallet.create({
          data: {
            volunteerId: profile.id,
            balance: 0n,
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
      console.error(error)
      return res.status(500).json({ message: "Failed to submit volunteer application" })
    }
  }