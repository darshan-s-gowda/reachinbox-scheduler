# Architecture Notes

## Durable scheduling

A schedule request creates authoritative rows in PostgreSQL first, then adds one delayed BullMQ job per email. Redis is configured with AOF persistence. Each job ID is the email UUID, so duplicate enqueue attempts are rejected by BullMQ.

## Safe processing

The worker reads the PostgreSQL row and atomically changes `SCHEDULED` or `FAILED` to `PROCESSING`. Only the worker that wins that update can send the message. A completed send changes the row to `SENT` and indexes the result in Elasticsearch.

## Rate limiting

Redis Lua scripts reserve sender/hour capacity and a sender delay slot atomically. This is safe across multiple worker processes. When capacity is exhausted, the active job creates a replacement delayed job for the next UTC hour. A Redis notification key prevents repeated Slack alerts for the same sender/hour.

## Search

PostgreSQL remains authoritative. Elasticsearch is a derived index for fast recipient/subject/body/sender search. Batch indexing is used for large schedules to avoid creating thousands of concurrent HTTP requests.

## Scaling

For 1000+ emails scheduled together, enqueueing is bulked with BullMQ `addBulk`, search indexing is bulked with Elasticsearch `_bulk`, and workers use configurable concurrency. Sender-specific Redis reservation prevents multiple workers from bypassing the same hourly quota.

## Security boundary

In production, the intended network boundary is: Internet -> HTTPS reverse proxy -> Express API. PostgreSQL, Redis, and Elasticsearch remain private. The application enables Helmet, strict CORS, secure/httpOnly session cookies, CSRF protection for state-changing API calls, OAuth state validation, authenticated/admin-only routes, Redis-backed API rate limits, request-size limits, server-side schema validation, and configurable email resource caps.
