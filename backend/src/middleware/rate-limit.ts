import type { NextFunction, Request, Response } from "express";
import { redis } from "../config/redis";

export function redisRateLimit(options: { key: string; limit: number; windowSeconds: number }) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identity = req.user?.id ?? req.ip ?? "anonymous";
      const key = `http-rate:${options.key}:${identity}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, options.windowSeconds);
      res.setHeader("X-RateLimit-Limit", options.limit);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, options.limit - count));
      if (count > options.limit) return res.status(429).json({ message: "Too many requests. Please try again later." });
      return next();
    } catch {
      return res.status(503).json({ message: "Rate limiter unavailable" });
    }
  };
}
