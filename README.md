# ReachInbox Email Scheduler

Production-style full-stack email scheduling assignment implementation using TypeScript, Express, PostgreSQL, Redis, BullMQ, Elasticsearch, Ethereal SMTP, React and Tailwind CSS.

## Architecture

React dashboard → Express API → PostgreSQL (source of truth) + Redis/BullMQ (durable execution) + Elasticsearch (search).

The API process starts a BullMQ worker automatically; a separate worker process can also be run for horizontal scaling. Workers enforce configurable concurrency, a minimum inter-send delay, and a Redis-backed per-sender hourly limit. Rate-limited jobs are rescheduled instead of dropped.

Email records use an atomic status transition and deterministic BullMQ job IDs for idempotency.

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

The local Docker stack provides:

PostgreSQL
Redis
Elasticsearch
3. Backend
cd backend
copy .env.example .env
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev

The API runs on:

http://localhost:5000

Bull Board runs on:

http://localhost:5000/admin/queues

A separate worker process can be started with:

npm run worker

The API also starts a worker automatically for local/demo convenience.

4. Frontend
cd frontend
copy .env.example .env
npm install
npm run dev

The frontend runs on:

http://localhost:5173
Ethereal

Set ETHEREAL_USER and ETHEREAL_PASS in backend/.env.

The assignment uses Ethereal SMTP for safe email testing and preview rather than real recipient delivery.

An Ethereal account can be created from:

https://ethereal.email/

The backend exposes:

GET /api/emails/ethereal-preview

to inspect the latest sent-email record for the authenticated user.

Google OAuth

Create a Google OAuth web client.

Add the callback URL:

http://localhost:5000/api/auth/google/callback

Set:

GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL

in .env.

Google OAuth was tested successfully in the local implementation.

Slack OAuth

Create a Slack app and configure its redirect URL:

http://localhost:5000/api/slack/callback

Set:

SLACK_CLIENT_ID
SLACK_CLIENT_SECRET
SLACK_REDIRECT_URI

in .env.

The default Slack bot scope is:

chat:write

This is the minimum scope required by the implemented rate-limit notification flow.

The Slack app is authorized through OAuth and posts rate-limit notifications to the configured Slack channel.

Slack OAuth was tested successfully in the local implementation.

Search

Emails are indexed into Elasticsearch under:

emails

Search endpoint:

GET /api/emails/search?q=alice

Search requests are scoped to the authenticated user's email records.

Scheduling and rate limiting

Each scheduled email gets a deterministic BullMQ job ID equal to its database ID.

The SMTP message also carries a deterministic:

X-ReachInbox-Email-Id

header.

PostgreSQL uses an atomic claim before sending to prevent concurrent duplicate processing.

The job delay is calculated from its scheduled time.

Redis persists BullMQ data, and the Docker Redis service uses AOF persistence.

Workers use configurable concurrency:

WORKER_CONCURRENCY

Before sending, the worker obtains a Redis-backed sender/hour reservation.

If the hourly quota is full, the job is rescheduled to the next available hour rather than failed.

A Lua script makes the reservation atomic across workers/instances.

The minimum inter-send delay is enforced using a Redis-backed sender timing key.

Default development settings:

concurrency: 5
minimum delay: 2 seconds
hourly limit: 100 emails per sender

For large batches, jobs remain durable in Redis while workers process them concurrently. The sender-specific Redis rate limiter controls hourly throughput and minimum spacing between sends.

Restart persistence test

The restart-persistence requirement was verified successfully.

Test procedure:

Schedule an email a few minutes in the future.
Stop the backend process.
Restart the backend.
Restart the worker.
Verify the scheduled job remains available.
Verify the email is eventually sent.
Verify the PostgreSQL record changes to SENT.
Verify the email is indexed in Elasticsearch.
Verify the email appears in the Sent UI.

The verified test email:

Subject: Restart Persistence Test
Status: SENT

The delayed BullMQ job survived the backend/worker restart and was successfully processed.

Demo checklist
Google login
Upload CSV/text leads
Schedule email batch
Show scheduled table
Open Bull Board
Restart backend/worker
Show email in Ethereal
Show Sent table
Search by recipient/subject
Connect Slack
Temporarily lower MAX_EMAILS_PER_HOUR
Schedule several emails
Demonstrate rate-limit deferral
Demonstrate Slack notification
Trade-offs
PostgreSQL is authoritative for business state; Elasticsearch is a derived search index.
The local Elasticsearch stack runs without authentication for assignment simplicity. Production should use TLS and authenticated Elasticsearch.
Ethereal is intentionally non-delivery SMTP for demo verification.
Slack OAuth access tokens and incoming webhook URLs are encrypted at rest using AES-256-GCM before being stored in PostgreSQL.
The local development stack uses Express's default session store to avoid requiring an additional session-store dependency. A Redis-backed session store should be used for a multi-instance production deployment.
OAuth credentials are environment-specific and must be configured by the deployment environment.
Security hardening

The project includes a security baseline suitable for an assignment/demo deployment:

Secrets are loaded from environment variables; .env files are ignored by Git and no credentials are committed.
Environment configuration is validated at startup with Zod, including session-secret requirements, encryption-key format, OAuth configuration, and configurable resource caps.
Authentication is enforced on email and Slack APIs; Bull Board is protected by an allow-list of ADMIN_EMAILS.
Google OAuth uses Passport authentication and session regeneration after successful login to reduce session-fixation risk.
Slack OAuth uses a cryptographically random, session-bound state value and validates it on callback.
State-changing API requests use a session-bound CSRF token sent in X-CSRF-Token.
HTTP security headers are enabled with Helmet.
Production mode rejects non-HTTPS requests. TLS termination should be handled by the reverse proxy/load balancer.
CORS is restricted to the configured frontend origin and credentials are only enabled for that origin.
Session cookies are httpOnly, sameSite=lax, and secure in production. The session cookie uses a non-default name.
JSON and URL-encoded request bodies have explicit size limits.
Redis-backed API rate limiting protects scheduling and search endpoints across multiple backend instances.
Email scheduling has configurable resource caps (MAX_EMAILS_PER_SCHEDULE and MAX_EMAILS_PER_HOUR) to prevent accidental or unbounded sends.
CSV/text lead files are processed in the browser only, with extension/MIME and size checks; raw files are not uploaded to the API.
Server-side Zod validation re-validates recipients, sender, subject, body, schedule time, delay, and hourly limit. Prisma uses parameterized database access.
React renders email content as text, avoiding dangerouslySetInnerHTML and reducing XSS exposure.
Elasticsearch search is scoped by authenticated userId, and query length is capped.
Error responses intentionally expose generic messages rather than stack traces or secrets; detailed errors remain server-side.
PostgreSQL, Redis, and Elasticsearch are bound to localhost in the local Docker Compose configuration instead of being exposed on every network interface.
Production deployments should place the API behind an HTTPS reverse proxy, keep infrastructure ports private, rotate OAuth/SMTP/Slack credentials, and use a persistent Redis-backed session store rather than Express's development MemoryStore.
Security assumptions / trade-offs

The assignment's local development stack uses Express's default session store so the repository can run without another package/service.

For a multi-instance production deployment, replace it with a Redis-backed session store before scaling horizontally.

The rate limiter, BullMQ, and application data are already Redis/DB backed and therefore safe to coordinate across workers.

Ethereal is a test SMTP service and has no production delivery cost. The configurable email caps are therefore treated as resource/spend guardrails for the scheduler rather than billing enforcement.

Credential protection

Slack OAuth access tokens and incoming webhook URLs are encrypted at rest using AES-256-GCM with the 32-byte ENCRYPTION_KEY.

The encryption format uses:

random 12-byte IV
AES-256-GCM authenticated encryption
authentication tag
encrypted ciphertext

Never commit ENCRYPTION_KEY.

In production, the key should be supplied by a secret manager and rotated under a planned key-rotation procedure.

Verified implementation

The following functionality was tested in the local environment:

PostgreSQL connectivity
Redis connectivity
Elasticsearch connectivity
Prisma migrations
Backend TypeScript compilation
Frontend development server
Google OAuth login
Slack OAuth connection
Slack status and channel connection
Ethereal SMTP authentication
Actual Ethereal email sending
Scheduled email execution
BullMQ delayed jobs
Worker concurrency
Redis-backed hourly rate limiting
Minimum inter-send delay
Slack rate-limit notification
BullMQ restart persistence
PostgreSQL email state persistence
Elasticsearch indexing
Elasticsearch search
Application-level email search
User-scoped email queries
CSRF protection
Helmet security headers
CORS restrictions
Environment validation
AES-256-GCM Slack secret encryption
Git secret protection
Security checklist used in this repository
 API keys/secrets only via environment variables; .env ignored by Git
 Startup environment validation and production HTTPS checks
 Authenticated application routes
 Admin-only Bull Board using ADMIN_EMAILS
 Session fixation mitigation after Google login
 Google OAuth authentication/state protection
 Slack OAuth state validation
 CSRF token on state-changing API requests
 Exact-origin CORS policy
 Helmet security headers
 Secure/httpOnly/sameSite cookies
 Redis-backed API rate limiting
 Configurable email/hour and per-schedule resource caps
 Client-side CSV/text file size/type checks; files are not uploaded to the server
 Server-side Zod input validation
 Prisma parameterized database access
 React-safe output rendering; no raw HTML injection
 User-scoped Elasticsearch queries
 User-scoped email queries
 Generic production error responses
 Infrastructure ports bound to localhost in local Compose
 Production reverse-proxy/HTTPS deployment guidance
 Slack secrets encrypted at rest with AES-256-GCM
 Redis/BullMQ restart persistence
 Atomic email-processing claim for idempotency
 Rate-limited jobs rescheduled instead of dropped
 Slack notification deduplication for rate-limit events

**That is the only README update for this step.**