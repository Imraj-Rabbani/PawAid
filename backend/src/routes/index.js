import { Router } from "express";
import { getUserProfile, login, register } from "../modules/auth/auth.controller.js";
import { volunteers } from "../modules/volunteer/volunteer.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
const router = Router()

router.post("/signup", register)
router.post("/signin", login)
router.get("/profile/:userId", requireAuth, getUserProfile)

router.get("/volunteer", volunteers)


export default router