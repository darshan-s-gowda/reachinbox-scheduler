import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";
import { prisma } from "../config/database";
import { emailQueue } from "../queue/email.queue";
import { indexEmail, indexEmails } from "./search.service";

let transporter: Transporter | null = null;

async function getTransporter() {
  if (transporter) return transporter;
  if (env.ETHEREAL_USER && env.ETHEREAL_PASS) {
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: env.ETHEREAL_USER, pass: env.ETHEREAL_PASS },
    });
  } else {
    const account = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
  host: account.smtp.host,
  port: account.smtp.port,
  secure: account.smtp.secure,
  auth: {
    user: account.user,
    pass: account.pass,
  },
});
  }
  return transporter;
}

export async function scheduleEmails(params: {
  userId: string;
  sender: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime: Date;
  delayMs: number;
  hourlyLimit: number;
}) {
  if (params.recipients.length > env.MAX_EMAILS_PER_SCHEDULE) throw new Error("Schedule exceeds configured email cap");

  const emails = await prisma.$transaction(
    params.recipients.map((recipient, index) =>
      prisma.email.create({
        data: {
          userId: params.userId,
          sender: params.sender,
          recipient,
          subject: params.subject,
          body: params.body,
          scheduledAt: new Date(params.startTime.getTime() + index * params.delayMs),
          hourlyLimit: Math.min(params.hourlyLimit, env.MAX_EMAILS_PER_HOUR),
        },
      }),
    ),
  );

  await emailQueue.addBulk(emails.map((email) => ({
    name: "send-email",
    data: { emailId: email.id },
    opts: {
      jobId: email.id,
      delay: Math.max(0, email.scheduledAt.getTime() - Date.now()),
      removeOnComplete: { age: 86400, count: 10000 },
      removeOnFail: { age: 604800, count: 10000 },
    },
  })));
  await indexEmails(emails);

  return emails;
}

export async function sendEmail(emailId: string) {
  const email = await prisma.email.findUnique({ where: { id: emailId } });
  if (!email) return { skipped: true };
  if (email.status === "SENT") return { skipped: true };

  const claimed = await prisma.email.updateMany({
    where: { id: emailId, status: { in: ["SCHEDULED", "FAILED"] } },
    data: { status: "PROCESSING", attempts: { increment: 1 }, errorMessage: null },
  });
  if (claimed.count !== 1) return { skipped: true };

  try {
    const mailer = await getTransporter();
    const info = await mailer.sendMail({
      from: email.sender,
      to: email.recipient,
      subject: email.subject,
      text: email.body,
      headers: { "X-ReachInbox-Email-Id": email.id },
    });

    const sent = await prisma.email.update({
      where: { id: emailId },
      data: { status: "SENT", sentAt: new Date(), errorMessage: null },
    });
    await indexEmail(sent);
    return { messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SMTP error";
    const failed = await prisma.email.update({
      where: { id: emailId },
      data: { status: "FAILED", errorMessage: message },
    });
    await indexEmail(failed);
    throw error;
  }
}

export async function listEmails(userId: string, status?: "SCHEDULED" | "SENT" | "FAILED") {
  return prisma.email.findMany({
    where: { userId, ...(status ? { status } : {}) },
    orderBy: { scheduledAt: "asc" },
    take: 500,
  });
}
