import { Router } from "express";
import { failed, schedule, scheduled, search, sent, etherealPreview } from "../controllers/email.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { redisRateLimit } from "../middleware/rate-limit";

export const emailRouter = Router();
emailRouter.use(requireAuth);
emailRouter.post("/schedule", redisRateLimit({ key: "schedule", limit: 20, windowSeconds: 60 }), schedule);
emailRouter.get("/scheduled", scheduled);
emailRouter.get("/sent", sent);
emailRouter.get("/failed", failed);
emailRouter.get("/search", redisRateLimit({ key: "search", limit: 60, windowSeconds: 60 }), search);
emailRouter.get("/ethereal-preview", etherealPreview);
