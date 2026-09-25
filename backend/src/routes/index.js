import express from "express";
import { Router } from "express";
import cors from "cors";
import { getUserProfile, login, register } from "../modules/auth/auth.controller.js";
import { volunteerApplication, volunteers } from "../modules/volunteer/volunteer.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { addArea, listAreas } from "../modules/rescue/rescue.controller.js";

const app = express()
const router = Router()

app.use(cors({
    origin: "http://localhost:5173"
}));

router.post("/signup", register)
router.post("/signin", login)
router.get("/profile/:userId", requireAuth, getUserProfile)

router.get("/area", listAreas)
router.post("/add-area", requireAuth, addArea)

router.get("/volunteer", volunteers)
router.post("/volunteer/apply", requireAuth, volunteerApplication)

export default router