import { prisma } from "../../db";
import { uploadToR2 } from "../../services/upload.services";
import { sanitizeUser } from "../auth/auth.utils";



export async function updateProfilePicture(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

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
    res.status(500).json({ error: "Failed to update user profile" });
  }
}

export async function getUserProfile(req, res){
  try {
      const {userId} = req.params

      const user = await prisma.user.findUnique({
          where: {id : userId},
      })

      if (!user) {
          return res.status(404).json({ error: "User not found" });
      }

      res.status(200).json(sanitizeUser(user));
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch user profile" });
      
  }
}

export async function updateProfile(req, res){
  try {
    const {userId} = req.user.id

    const {name, phone} = req.body

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
        volunteerProfile: true,
      },
    })

    res.json(user)

  } catch (error) {
    console.error(error);
      res.status(500).json({ error: "Failed to update user profile" });
  }
}