import { prisma } from "../../db.js";
import { uploadToR2 } from "../../services/upload.services.js";
import { sanitizeUser } from "../auth/auth.utils.js";



export async function updateProfilePicture(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const userId = req.user.id;
    const key = `profile-pictures/${userId}-${Date.now()}.${req.file.mimetype.split("/")[1]}`;

    const imageUrl = await uploadToR2(req.file.buffer, key, req.file.mimetype);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { profilePictureUrl: imageUrl },
      select: { id: true, name: true, email: true, profilePictureUrl: true },
    });

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update user profile" });
  }
}

export async function getUserProfile(req, res){
  try {
      const {userId} = req.params

      // a malformed id makes the lookup throw, treat it the same as a missing user
      const user = await prisma.user.findUnique({
          where: {id : userId},
          include: { wallet: true, volunteerProfile: { include: { rescueArea: true } } },
      }).catch(() => null)

      if (!user) {
          return res.status(404).json({ message: "User not found" });
      }

      // Contact details, wallet and NID are only visible to their owner and admins
      if (req.user.id !== user.id && req.user.role !== "ADMIN") {
          delete user.email
          delete user.phone
          delete user.address
          delete user.wallet
          if (user.volunteerProfile) delete user.volunteerProfile.nid
      }

      res.status(200).json(sanitizeUser(user));
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch user profile" });
      
  }
}

export async function updateProfile(req, res){
  try {
    const userId = req.user.id

    const {phone} = req.body
    const name = typeof req.body.name === "string" ? req.body.name.trim() : undefined

    if (name !== undefined && name.length < 3) {
      return res.status(400).json({ message: "Name must be at least 3 characters long." })
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        profilePictureUrl: true,
        wallet: true,
        volunteerProfile: { include: { rescueArea: true } },
      },
    })

    res.json(user)

  } catch (error) {
    console.error(error);
      res.status(500).json({ message: "Failed to update user profile" });
  }
}