import type { Request, Response } from "express";
import crypto from "node:crypto";
import { prisma } from "../config/database";
import { env } from "../config/env";
import { encryptSecret } from "../utils/secrets";

function requireSlackConfig(res: Response) {
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
    res.status(503).json({ message: "Slack OAuth is not configured" });
    return false;
  }
  return true;
}

export function connect(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (!requireSlackConfig(res)) return;

  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID!,
    scope: env.SLACK_BOT_SCOPES,
    redirect_uri: env.SLACK_REDIRECT_URI,
    state: crypto.randomBytes(24).toString("hex"),
  });
  req.session.slackOAuthState = params.get("state") ?? undefined;
  return res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
}

export async function callback(req: Request, res: Response) {
  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) return res.redirect(`${env.FRONTEND_URL}/dashboard?slack=not-configured`);

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const expectedState = req.session.slackOAuthState;
  if (!code || !state || !expectedState || state !== expectedState) return res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error`);
  delete req.session.slackOAuthState;
  if (!req.user) return res.redirect(`${env.FRONTEND_URL}/login?error=session`);;

  const body = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    client_secret: env.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: env.SLACK_REDIRECT_URI,
  });

  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await response.json() as {
    ok: boolean;
    access_token?: string;
    team?: { id?: string };
    incoming_webhook?: { channel_id?: string; url?: string };
  };

  if (!data.ok || !data.access_token) return res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error`);

  await prisma.slackConnection.upsert({
    where: { userId: req.user.id },
    create: { userId: req.user.id, accessToken: encryptSecret(data.access_token), teamId: data.team?.id, channelId: data.incoming_webhook?.channel_id, webhookUrl: data.incoming_webhook?.url ? encryptSecret(data.incoming_webhook.url) : null },
    update: { accessToken: encryptSecret(data.access_token), teamId: data.team?.id, channelId: data.incoming_webhook?.channel_id, webhookUrl: data.incoming_webhook?.url ? encryptSecret(data.incoming_webhook.url) : null },
  });

  return res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
}

export async function status(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  const connection = await prisma.slackConnection.findUnique({ where: { userId: req.user.id }, select: { teamId: true, channelId: true, createdAt: true } });
  return res.json({ connected: Boolean(connection), connection });
}

export async function disconnect(req: Request, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  await prisma.slackConnection.deleteMany({ where: { userId: req.user.id } });
  return res.json({ ok: true });
}
