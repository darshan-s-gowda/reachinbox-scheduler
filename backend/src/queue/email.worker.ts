import { Worker } from "bullmq";
import { bullConnection } from "../config/redis";
import { env } from "../config/env";
import { prisma } from "../config/database";
import { emailQueue } from "./email.queue";
import { reserveSendSlot } from "../services/rate-limit.service";
import { sendEmail } from "../services/email.service";

export const emailWorker = new Worker<{ emailId: string }>(
  "email-send-queue",
  async (job) => {
    const email = await prisma.email.findUnique({ where: { id: job.data.emailId } });
    if (!email || email.status === "SENT") return { skipped: true };

    const reservation = await reserveSendSlot(email.sender, email.userId, email.hourlyLimit);
    if (!reservation.allowed) {
      await emailQueue.add(
        "send-email",
        { emailId: email.id },
        {
          jobId: `${email.id}:hour:${reservation.retryAt}`,
          delay: Math.max(0, reservation.retryAt - Date.now()),
        },
      );
      return { deferredUntil: reservation.retryAt };
    }

    if ((reservation.waitMs ?? 0) > 0) {
      await emailQueue.add(
        "send-email",
        { emailId: email.id },
        {
          jobId: `${email.id}:delay:${reservation.retryAt}`,
          delay: reservation.waitMs ?? 0,
        },
      );
      return { deferredUntil: reservation.retryAt };
    }

    return sendEmail(email.id);
  },
  {
    connection: bullConnection,
    concurrency: env.WORKER_CONCURRENCY,
  },
);

emailWorker.on("completed", (job) => {
  console.log(`[worker] completed ${job.id}`, job.returnvalue ?? "");
});

emailWorker.on("failed", (job, error) => {
  console.error(`[worker] failed ${job?.id}: ${error.message}`);
});

if (require.main === module) {
  console.log(`Email worker started with concurrency=${env.WORKER_CONCURRENCY}`);
}
