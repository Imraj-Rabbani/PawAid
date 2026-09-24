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


