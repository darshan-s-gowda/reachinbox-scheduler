import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "./config/env";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function csrfToken(req: Request, res: Response) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  return res.json({ token: req.session.csrfToken });
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.path.startsWith("/api/auth/google")) return next();
  if (req.path === "/api/slack/callback") return next();

  const expected = req.session.csrfToken;
  const supplied = req.get("X-CSRF-Token");
  if (!expected || !supplied || expected.length !== supplied.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
    return res.status(403).json({ message: "Invalid CSRF token" });
  }
  return next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const email = req.user?.email?.toLowerCase();
  const allowed = env.ADMIN_EMAILS;
  if (!email || !allowed.includes(email)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  return next();
}

export function validateProductionSecurity(req: Request, res: Response, next: NextFunction) {
  if (env.NODE_ENV === "production" && !req.secure) {
    return res.status(400).json({ message: "HTTPS is required" });
  }
  return next();
}
