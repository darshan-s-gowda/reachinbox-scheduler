import { Router } from "express";
import { googleCallback, googleStart, logout, me } from "../controllers/auth.controller";
import { csrfToken } from "../security";
import { redisRateLimit } from "../middleware/rate-limit";

export const authRouter = Router();
authRouter.get("/csrf", csrfToken);
authRouter.get("/google", redisRateLimit({ key: "google-oauth", limit: 20, windowSeconds: 300 }), googleStart);
authRouter.get("/google/callback", googleCallback);
authRouter.get("/me", me);
authRouter.post("/logout", logout);
