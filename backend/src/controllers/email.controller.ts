import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import { listEmails, scheduleEmails } from "../services/email.service";
import { searchEmails } from "../services/search.service";
import { env } from "../config/env";

const scheduleSchema = z.object({
  sender: z.string().email(),
  recipients: z.array(z.string().email()).min(1).max(env.MAX_EMAILS_PER_SCHEDULE),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(100000),
  startTime: z.string().datetime(),
  delayMs: z.number().int().min(0).max(3600000),
  hourlyLimit: z.number().int().positive().max(100000),
});

function userId(req: Request) {
  return req.user?.id;
}

export async function schedule(req: Request, res: Response) {
  const id = userId(req);
  if (!id) return res.status(401).json({ message: "Authentication required" });

  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid request", issues: parsed.error.issues });

  if (parsed.data.hourlyLimit > env.MAX_EMAILS_PER_HOUR) return res.status(400).json({ message: "Hourly limit exceeds server maximum" });

  const start = new Date(parsed.data.startTime);
  if (start.getTime() < Date.now() - 5000) return res.status(400).json({ message: "Start time must be in the future" });

  const emails = await scheduleEmails({ userId: id, ...parsed.data, startTime: start });
  return res.status(201).json({ count: emails.length, emails });
}

export async function scheduled(req: Request, res: Response) {
  const id = userId(req);
  if (!id) return res.status(401).json({ message: "Authentication required" });
  return res.json(await listEmails(id, "SCHEDULED"));
}

export async function sent(req: Request, res: Response) {
  const id = userId(req);
  if (!id) return res.status(401).json({ message: "Authentication required" });
  return res.json(await listEmails(id, "SENT"));
}

export async function failed(req: Request, res: Response) {
  const id = userId(req);
  if (!id) return res.status(401).json({ message: "Authentication required" });
  return res.json(await listEmails(id, "FAILED"));
}

export async function search(req: Request, res: Response) {
  const id = userId(req);
  if (!id) return res.status(401).json({ message: "Authentication required" });
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) return res.status(400).json({ message: "Query is required" });
  if (q.length > env.MAX_SEARCH_LENGTH) return res.status(400).json({ message: "Query is too long" });
  return res.json(await searchEmails(id, q));
}

export async function etherealPreview(_req: Request, res: Response) {
  const latest = await prisma.email.findFirst({ where: { status: "SENT" }, orderBy: { sentAt: "desc" } });
  return res.json({ message: "Ethereal preview URLs are returned in worker logs/response for test sends.", latest });
}
