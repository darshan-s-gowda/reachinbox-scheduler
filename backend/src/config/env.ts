import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  ELASTICSEARCH_URL: z.string().default("http://localhost:9200"),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  ADMIN_EMAILS: z.string().default("").transform((value) => value.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean)),
  MAX_EMAILS_PER_SCHEDULE: z.coerce.number().int().positive().max(10000).default(5000),
  MAX_BODY_BYTES: z.coerce.number().int().positive().max(10_000_000).default(2_000_000),
  MAX_SEARCH_LENGTH: z.coerce.number().int().positive().max(500).default(200),
  SESSION_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, "ENCRYPTION_KEY must be 32 random bytes encoded as 64 hex characters"),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  MIN_EMAIL_DELAY_MS: z.coerce.number().int().nonnegative().default(2000),
  MAX_EMAILS_PER_HOUR: z.coerce.number().int().positive().default(100),
  ETHEREAL_USER: z.string().optional(),
  ETHEREAL_PASS: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().default("http://localhost:5000/api/auth/google/callback"),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_REDIRECT_URI: z.string().default("http://localhost:5000/api/slack/callback"),
  SLACK_BOT_SCOPES: z.string().default("chat:write"),
});

const parsed = schema.parse(process.env);

if (parsed.NODE_ENV === "production") {
  for (const [name, value] of [["FRONTEND_URL", parsed.FRONTEND_URL], ["GOOGLE_CALLBACK_URL", parsed.GOOGLE_CALLBACK_URL], ["SLACK_REDIRECT_URI", parsed.SLACK_REDIRECT_URI]] as const) {
    if (!value.startsWith("https://")) throw new Error(`${name} must use HTTPS in production`);
  }
}

export const env = parsed;
