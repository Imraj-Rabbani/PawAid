import express from "express";
import { Router } from "express";
import cors from "cors";
import { login, register } from "../modules/auth/auth.controller.js";
import { updateVolunteerProfile, volunteer, volunteerApplication, volunteers } from "../modules/volunteer/volunteer.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { addArea, listAreas } from "../modules/rescue/rescue.controller.js";
import { updateProfilePicture, getUserProfile, updateProfile } from "../modules/user/user.controller.js";
import { upload } from "../middleware/upload.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { getStats } from "../modules/admin/admin.controller.js";

const app = express()
const router = Router()

app.use(cors({
    origin: "http://localhost:5173"
}));

router.post("/signup", register)
router.post("/signin", login)


router.get("/profile/:userId", requireAuth, getUserProfile)
router.put("/profile/update", requireAuth, updateProfile)
router.put("/users/profile-picture", requireAuth, upload.single("profilePicture"), updateProfilePicture)


router.get("/area", listAreas)
router.post("/add-area", requireAuth, requireAdmin, addArea)


router.get("/admin/stats", requireAuth, requireAdmin, getStats)


router.get("/volunteer", volunteers)
router.post("/volunteer/apply", requireAuth, volunteerApplication)
router.get("/volunteer/profile", requireAuth, volunteer)
router.put("/volunteer/profile", requireAuth, updateVolunteerProfile)

export default router