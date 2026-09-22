import { Router } from "express";
import { login, register } from "../modules/auth/auth.controller.js";
const router = Router()

router.post("/signup", register)
router.post("/signin", login)


export default router