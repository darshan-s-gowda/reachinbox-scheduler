# ReachInbox Email Scheduler

Production-style full-stack email scheduling assignment implementation using TypeScript, Express, PostgreSQL, Redis, BullMQ, Elasticsearch, Ethereal SMTP, React and Tailwind CSS.

## Architecture

React dashboard → Express API → PostgreSQL (source of truth) + Redis/BullMQ (durable execution) + Elasticsearch (search). BullMQ worker (the API process starts a worker automatically; a separate worker process can be run for horizontal scaling) enforce configurable concurrency, a minimum inter-send delay and a Redis-backed per-sender hourly limit. Rate-limited jobs are rescheduled instead of dropped. Email records use an atomic status transition and BullMQ job IDs for idempotency.

## Requirements covered

- TypeScript + Express backend
- PostgreSQL persistence with Prisma 7
- BullMQ delayed jobs backed by Redis; no cron jobs
- Restart-safe delayed jobs via persistent Redis AOF + PostgreSQL state
- Ethereal SMTP integration
- Configurable worker concurrency
- Configurable minimum delay
- Redis-backed hourly sender rate limit
- Slack OAuth + live rate-limit notification
- Elasticsearch indexing/search
- Bull Board live queue dashboard
- Google OAuth login
- React + TypeScript + Tailwind dashboard
- CSV/text lead upload and validation
- Scheduled/Sent views, loading and empty states

## Quick start

### 1. Prerequisites

- Node.js 22+
- npm 10+
- Docker Desktop

### 2. Infrastructure

From the repository root:

```bash
docker compose up -d
```

### 3. Backend

```bash
cd backend
copy .env.example .env
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

The API runs on `http://localhost:5000`.
Bull Board runs at `http://localhost:5000/admin/queues`.

### 4. Frontend

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

## Ethereal

Set `ETHEREAL_USER` and `ETHEREAL_PASS` in `backend/.env`. The assignment can use an Ethereal account created from https://ethereal.email/ or a generated account. The backend exposes `/api/email/ethereal-preview` to verify SMTP configuration.

## Google OAuth

Create a Google OAuth web client. Add the callback URL:

`http://localhost:5000/api/auth/google/callback`

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.

## Slack OAuth

Create a Slack app and configure its redirect URL:

`http://localhost:5000/api/slack/callback`

Set `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_URI`, and optionally `SLACK_BOT_SCOPES`. The default scopes include `chat:write,channels:read,groups:read,incoming-webhook` so the app can post a live notification without requiring a manually selected channel.

## Search

Emails are indexed into Elasticsearch under `emails`. Search with:

`GET /api/emails/search?q=alice`

## Scheduling and rate limiting

Each scheduled email gets a deterministic BullMQ job ID equal to its database ID. The SMTP message also carries a deterministic `X-ReachInbox-Email-Id` header. PostgreSQL uses an atomic claim before send to prevent concurrent duplicate processing. The job's delay is calculated from its scheduled time. Redis persists BullMQ data, and the Docker Redis service uses AOF persistence.

Workers use configurable concurrency (`WORKER_CONCURRENCY`). Before sending, the worker obtains a Redis-backed sender/hour reservation. If the hourly quota is full, the job is moved to the next hour rather than failed. A Lua script makes the reservation atomic across workers/instances. The minimum delay is enforced with a Redis sender lock containing the last reservation time.

Default development settings:

- concurrency: 5
- minimum delay: 2 seconds
- hourly limit: 100 per sender

For 1000+ emails at the same time, all jobs can remain durable in Redis. The rate reservation spaces them across the current and future hour windows; the worker pool processes them concurrently while the sender-specific throttle preserves the configured pacing.

## Restart test

1. Schedule an email 2–5 minutes in the future.
2. Stop the backend process.
3. Start it again.
4. The delayed BullMQ job remains in Redis and is processed at its due time.

## Demo checklist

- Google login
- Schedule CSV leads
- Show scheduled table
- Open Bull Board
- Restart backend
- Show email arrives in Ethereal
- Show sent table
- Search by recipient/subject
- Connect Slack
- Temporarily set `MAX_EMAILS_PER_HOUR=2`, schedule several emails and demonstrate the Slack notification when the limit is reached

## Trade-offs

- PostgreSQL is authoritative for business state; Elasticsearch is a derived search index.
- The local stack runs Elasticsearch without security for assignment simplicity. Production should use TLS/authenticated Elasticsearch.
- Ethereal is intentionally non-delivery SMTP for demo verification.
- Slack tokens are stored in PostgreSQL for this assignment; production should encrypt them at rest or use a secret manager.
- Google/Slack OAuth requires developer credentials and therefore cannot be fully exercised without the evaluator's credentials.

## Security hardening

The project intentionally includes a security baseline suitable for an assignment/demo deployment:

1. Secrets are loaded from environment variables; `.env` files are ignored by Git and no credentials are committed.
2. Environment configuration is validated at startup with Zod, including minimum session-secret length and configurable resource caps.
3. Authentication is enforced on email and Slack APIs; Bull Board is protected by an allow-list of `ADMIN_EMAILS`.
4. Google OAuth uses Passport's state protection and login regenerates the session to reduce session-fixation risk.
5. Slack OAuth uses a cryptographically random, session-bound state value and validates it on callback.
6. State-changing API requests use a session-bound CSRF token sent in `X-CSRF-Token`.
7. HTTP security headers are enabled with Helmet; production HSTS is enabled through Helmet.
8. Production mode rejects non-HTTPS requests. TLS termination should be handled by the reverse proxy/load balancer.
9. CORS is restricted to the configured frontend origin and credentials are only enabled for that origin.
10. Session cookies are `httpOnly`, `sameSite=lax`, and `secure` in production; the cookie name is non-default.
11. JSON and URL-encoded request bodies have explicit size limits.
12. Redis-backed API rate limiting protects scheduling, search, and OAuth initiation endpoints across multiple backend instances.
13. Email scheduling has configurable resource caps (`MAX_EMAILS_PER_SCHEDULE` and `MAX_EMAILS_PER_HOUR`) to prevent accidental/unbounded sends.
14. CSV/text lead files are processed in the browser only, with extension/MIME and 5 MB size checks; raw files are never uploaded to the API.
15. Server-side Zod validation re-validates all recipients, sender, subject, body, schedule time, delay, and hourly limit. Prisma uses parameterized queries, avoiding SQL string interpolation.
16. React renders email content as text, avoiding `dangerouslySetInnerHTML` and reducing XSS exposure.
17. Elasticsearch search is scoped by authenticated `userId`, and query length is capped.
18. Error responses intentionally expose generic messages rather than stack traces or secrets; detailed errors remain server-side.
19. PostgreSQL, Redis, and Elasticsearch are bound to loopback in the local Docker Compose configuration instead of being exposed on every network interface.
20. Production deployments should place the API behind an HTTPS reverse proxy, keep infrastructure ports private, rotate OAuth/SMTP/Slack credentials, and use a persistent Redis-backed session store rather than Express's development MemoryStore.

### Security assumptions / trade-offs

The assignment's local development stack uses Express's default session store so the repository can run without another package/service. For a multi-instance production deployment, replace it with a Redis-backed session store before scaling horizontally. The rate limiter, BullMQ, and application data are already Redis/DB backed and therefore safe to coordinate across workers.

Ethereal is a test SMTP service and has no production delivery cost. The configurable email caps are therefore treated as resource/spend guardrails for the scheduler rather than billing enforcement.

### Credential protection

Slack OAuth access tokens and incoming-webhook URLs are encrypted at rest with AES-256-GCM using the 32-byte `ENCRYPTION_KEY`. Never commit that key. In production it should be supplied by a secret manager and rotated under a planned key-rotation procedure.

## Security checklist used in this repository

- [x] API keys/secrets only via environment variables; `.env` ignored by Git
- [x] Startup environment validation and production HTTPS checks
- [x] Authenticated application routes
- [x] Admin-only Bull Board using `ADMIN_EMAILS`
- [x] Session fixation mitigation after Google login
- [x] Google OAuth state validation
- [x] Slack OAuth state validation
- [x] CSRF token on state-changing API requests
- [x] Exact-origin CORS policy
- [x] Helmet security headers
- [x] Secure/httpOnly/sameSite cookies
- [x] Redis-backed API rate limiting
- [x] Configurable email/hour and per-schedule resource caps
- [x] Client-side CSV/text file size/type checks; files are not uploaded to the server
- [x] Server-side Zod input validation
- [x] Prisma parameterized database access
- [x] React-safe output rendering; no raw HTML injection
- [x] User-scoped Elasticsearch queries
- [x] Generic production error responses
- [x] Infrastructure ports bound to localhost in local Compose
- [x] Production reverse-proxy/HTTPS deployment guidance
- [x] Slack secrets encrypted at rest with AES-256-GCM
