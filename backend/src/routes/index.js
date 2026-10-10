import { Router } from "express";
import { login, register } from "../modules/auth/auth.controller.js";
import { updateVolunteerProfile, volunteer, volunteerApplication, volunteerById, volunteers } from "../modules/volunteer/volunteer.controller.js";
import { optionalAuth, requireAuth } from "../middleware/auth.middleware.js";
import { addArea, assignPost, createPost, deletePost, listAreas, listPosts, removeUpvote, updatePost, updatePostProgress, upvotePost } from "../modules/rescue/rescue.controller.js";
import { updateProfilePicture, getUserProfile, updateProfile } from "../modules/user/user.controller.js";
import { upload } from "../middleware/upload.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import { requireActiveVolunteer } from "../middleware/volunteer.middleware.js";
import {
    deleteArea, getStats, listAdminAreas, listAdminPosts, listReports, listTransactions, listUsers,
    listVolunteers, renameArea, updatePostStatus, updateReportStatus, updateUserStatus, updateVolunteerStatus,
} from "../modules/admin/admin.controller.js";
import { myWallet, myWalletTransactions, topUpWallet, transferToVolunteer } from "../modules/wallet/wallet.controller.js";
import { donateToPost, donateToVolunteer, listDonations, myDonations } from "../modules/donation/donation.controller.js";
import { createComment, deleteComment, listComments } from "../modules/comment/comment.controller.js";
import { homeSummary } from "../modules/home/home.controller.js";
import { transparencyOverview } from "../modules/transparency/transparency.controller.js";
import { reportPost } from "../modules/report/report.controller.js";

const router = Router()

router.post("/signup", register)
router.post("/signin", login)


router.get("/profile/:userId", requireAuth, getUserProfile)
router.put("/profile/update", requireAuth, updateProfile)
router.put("/users/profile-picture", requireAuth, upload.single("profilePicture"), updateProfilePicture)


router.get("/home/summary", optionalAuth, homeSummary)
router.get("/transparency", transparencyOverview)


router.get("/area", listAreas)
router.post("/add-area", requireAuth, requireAdmin, addArea)


router.get("/rescue-post", optionalAuth, listPosts)
router.post("/rescue-post", requireAuth, upload.array("images", 5), createPost)
router.get("/rescue-post/:postId/comments", listComments)
router.post("/rescue-post/:postId/comments", requireAuth, createComment)
router.delete("/comments/:commentId", requireAuth, deleteComment)
router.post("/rescue-post/:postId/upvote", requireAuth, upvotePost)
router.delete("/rescue-post/:postId/upvote", requireAuth, removeUpvote)
router.post("/rescue-post/:postId/report", requireAuth, reportPost)
router.post("/rescue-post/:postId/assign", requireAuth, requireActiveVolunteer, assignPost)
router.patch("/rescue-post/:postId/progress", requireAuth, requireActiveVolunteer, upload.single("photo"), updatePostProgress)
router.put("/rescue-post/:postId", requireAuth, updatePost)
router.delete("/rescue-post/:postId", requireAuth, deletePost)


// every /admin route below needs a signed in admin
router.use("/admin", requireAuth, requireAdmin)
router.get("/admin/stats", getStats)
router.get("/admin/users", listUsers)
router.patch("/admin/users/:userId/status", updateUserStatus)
router.get("/admin/volunteers", listVolunteers)
router.patch("/admin/volunteers/:volunteerId/status", updateVolunteerStatus)
router.get("/admin/posts", listAdminPosts)
router.patch("/admin/posts/:postId/status", updatePostStatus)
router.get("/admin/reports", listReports)
router.patch("/admin/reports/:reportId", updateReportStatus)
router.get("/admin/areas", listAdminAreas)
router.patch("/admin/areas/:areaId", renameArea)
router.delete("/admin/areas/:areaId", deleteArea)
router.get("/admin/transactions", listTransactions)


router.get("/volunteer", volunteers)
router.post("/volunteer/apply", requireAuth, volunteerApplication)
router.get("/volunteer/profile", requireAuth, volunteer)
router.put("/volunteer/profile", requireAuth, requireActiveVolunteer, updateVolunteerProfile)
// keep after /volunteer/profile so "profile" is not treated as an id
router.get("/volunteer/:id", volunteerById)


router.get("/wallet/me", requireAuth, myWallet)
router.post("/wallet/top-up", requireAuth, topUpWallet)
router.get("/wallet/transactions", requireAuth, myWalletTransactions)
router.post("/wallet/transfer", requireAuth, requireActiveVolunteer, transferToVolunteer)


router.get("/donations", listDonations)
router.get("/donations/me", requireAuth, myDonations)
router.post("/donations/volunteer/:volunteerId", requireAuth, donateToVolunteer)
router.post("/donations/rescue-post/:postId", requireAuth, donateToPost)

export default router