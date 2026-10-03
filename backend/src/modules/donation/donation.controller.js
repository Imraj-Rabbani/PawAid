import { prisma } from "../../db.js";

const donationSelect = {
  id: true,
  amount: true,
  destinationType: true,
  createdAt: true,
  payment: { select: { status: true } },
  rescuePost: { select: { id: true, title: true } },
};

const publicUserSelect = { id: true, name: true, profilePictureUrl: true };


// Donations the signed in user made, and (for volunteers) the ones they received
export async function myDonations(req, res) {
  try {
    const userId = req.user.id

    const volunteer = await prisma.volunteerProfile.findUnique({
      where: { userId },
      select: { id: true },
    })

    const [made, received] = await Promise.all([
      prisma.donation.findMany({
        where: { donorId: userId },
        select: {
          ...donationSelect,
          volunteer: { select: { id: true, user: { select: publicUserSelect } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      volunteer
        ? prisma.donation.findMany({
            where: { volunteerId: volunteer.id },
            select: { ...donationSelect, donor: { select: publicUserSelect } },
            orderBy: { createdAt: "desc" },
          })
        : [],
    ])

    return res.json({
      message: "Donations listed",
      data: { made, received },
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch donations" });
  }
}
