import { Router } from "express";
import { login, register } from "../modules/auth/auth.controller.js";
import { updateVolunteerProfile, volunteer, volunteerApplication, volunteerById, volunteers } from "../modules/volunteer/volunteer.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { addArea, createPost, listAreas, listPosts } from "../modules/rescue/rescue.controller.js";
import { updateProfilePicture, getUserProfile, updateProfile } from "../modules/user/user.controller.js";
import { upload } from "../middleware/upload.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireActiveVolunteer } from "../middleware/volunteer.middleware.js";
import { getStats } from "../modules/admin/admin.controller.js";
import { myWallet, topUpWallet } from "../modules/wallet/wallet.controller.js";
import { donateToVolunteer, myDonations } from "../modules/donation/donation.controller.js";
import { createComment, deleteComment, listComments } from "../modules/comment/comment.controller.js";

const router = Router()

router.post("/signup", register)
router.post("/signin", login)


router.get("/profile/:userId", requireAuth, getUserProfile)
router.put("/profile/update", requireAuth, updateProfile)
router.put("/users/profile-picture", requireAuth, upload.single("profilePicture"), updateProfilePicture)


router.get("/area", listAreas)
router.post("/add-area", requireAuth, requireAdmin, addArea)


router.get("/rescue-post", listPosts)
router.post("/rescue-post", requireAuth, upload.array("images", 5), createPost)
router.get("/rescue-post/:postId/comments", listComments)
router.post("/rescue-post/:postId/comments", requireAuth, createComment)
router.delete("/comments/:commentId", requireAuth, deleteComment)


router.get("/admin/stats", requireAuth, requireAdmin, getStats)


router.get("/volunteer", volunteers)
router.post("/volunteer/apply", requireAuth, volunteerApplication)
router.get("/volunteer/profile", requireAuth, volunteer)
router.put("/volunteer/profile", requireAuth, requireActiveVolunteer, updateVolunteerProfile)
// keep after /volunteer/profile so "profile" is not treated as an id
router.get("/volunteer/:id", volunteerById)


router.get("/wallet/me", requireAuth, myWallet)
router.post("/wallet/top-up", requireAuth, topUpWallet)


router.get("/donations/me", requireAuth, myDonations)
router.post("/donations/volunteer/:volunteerId", requireAuth, donateToVolunteer)

export default router