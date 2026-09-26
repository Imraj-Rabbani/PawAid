import { prisma } from "../../db";
import { uploadToR2 } from "../../services/upload.services";



export async function updateProfilePicture(req, res){
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
        const userId = req.user.id; // from requireAuth
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