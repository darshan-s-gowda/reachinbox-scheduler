import { elasticsearch, EMAIL_INDEX } from "../config/elasticsearch";
import type { Email } from "../generated/prisma/client";
export async function ensureEmailIndex() {
  const exists = await elasticsearch.indices.exists({ index: EMAIL_INDEX });
  if (!exists) {
    await elasticsearch.indices.create({
      index: EMAIL_INDEX,
      mappings: {
        properties: {
          id: { type: "keyword" },
          userId: { type: "keyword" },
          sender: { type: "keyword" },
          recipient: { type: "text" },
          subject: { type: "text" },
          body: { type: "text" },
          status: { type: "keyword" },
          scheduledAt: { type: "date" },
          sentAt: { type: "date" },
        },
      },
    });
  }
}

export async function indexEmail(email: Email) {
  await ensureEmailIndex();
  await elasticsearch.index({
    index: EMAIL_INDEX,
    id: email.id,
    document: {
      id: email.id,
      userId: email.userId,
      sender: email.sender,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
      status: email.status,
      scheduledAt: email.scheduledAt,
      sentAt: email.sentAt,
    },
    refresh: "wait_for",
  });
}

export async function searchEmails(userId: string, query: string) {
  await ensureEmailIndex();
  const result = await elasticsearch.search({
    index: EMAIL_INDEX,
    query: {
      bool: {
        must: [{ multi_match: { query, fields: ["recipient", "subject", "body", "sender"] } }],
        filter: [{ term: { userId } }],
      },
    },
    sort: [{ scheduledAt: "desc" }],
    size: 100,
  });
  return result.hits.hits.map((hit) => hit._source);
}

export async function indexEmails(emails: Email[]) {
  if (!emails.length) return;
  await ensureEmailIndex();
  await elasticsearch.bulk({
    refresh: "wait_for",
    operations: emails.flatMap((email) => [
      { index: { _index: EMAIL_INDEX, _id: email.id } },
      { id: email.id, userId: email.userId, sender: email.sender, recipient: email.recipient, subject: email.subject, body: email.body, status: email.status, scheduledAt: email.scheduledAt, sentAt: email.sentAt },
    ]),
  });
}
