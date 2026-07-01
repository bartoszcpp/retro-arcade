import { Router } from "express";
import { register, login, getLeaderboard } from "../controllers/auth";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/leaderboard", getLeaderboard);

export default router;
