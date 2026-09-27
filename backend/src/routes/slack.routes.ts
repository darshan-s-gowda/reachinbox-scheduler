import { Router } from "express";
import { callback, connect, disconnect, status } from "../controllers/slack.controller";
import { requireAuth } from "../middleware/auth.middleware";

export const slackRouter = Router();
slackRouter.get("/connect", requireAuth, connect);
slackRouter.get("/callback", callback);
slackRouter.get("/status", requireAuth, status);
slackRouter.post("/disconnect", requireAuth, disconnect);
