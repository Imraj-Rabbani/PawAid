import { Router } from "express";
import { register } from "../modules/auth/auth.controller.js";
const router = Router()

router.post("/signup", register)


export default router