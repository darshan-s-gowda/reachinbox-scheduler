import express from "express";
import { RedisStore } from "connect-redis";
import { sessionRedis } from "./config/redis";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import session from "express-session";
import passport from "passport";
import { env } from "./config/env";
import { configurePassport } from "./controllers/auth.controller";
import { authRouter } from "./routes/auth.routes";
import { emailRouter } from "./routes/email.routes";
import { slackRouter } from "./routes/slack.routes";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { createBullBoard } from "@bull-board/api";
import { ExpressAdapter } from "@bull-board/express";
import { emailQueue } from "./queue/email.queue";
import { csrfProtection, requireAdmin, validateProductionSecurity } from "./security";

configurePassport();

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", env.NODE_ENV === "production" ? 1 : false);

app.use(helmet({
  contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
  crossOriginEmbedderPolicy: false,
  hsts: env.NODE_ENV === "production" ? undefined : false,
}));

const allowedOrigins = new Set([env.FRONTEND_URL]);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-CSRF-Token"],
}));

app.use(validateProductionSecurity);
app.use(express.json({ limit: env.MAX_BODY_BYTES }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));


app.use(session({
  store: new RedisStore({
    client: sessionRedis,
  }),
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: "reachinbox.sid",
  cookie: {
    httpOnly: true,
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(csrfProtection);

const boardAdapter = new ExpressAdapter();
boardAdapter.setBasePath("/admin/queues");
createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter: boardAdapter });
app.use("/admin/queues", requireAdmin, boardAdapter.getRouter());

app.get("/health", (_req, res) => res.json({ ok: true, service: "reachinbox-scheduler" }));
app.use("/api/auth", authRouter);
app.use("/api/emails", emailRouter);
app.use("/api/slack", slackRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error instanceof Error ? error.message : "Unhandled server error");
  return res.status(500).json({ message: "Internal server error" });
});

export default app;
