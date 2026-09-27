import { Queue } from "bullmq";
import { bullConnection } from "../config/redis";

export const EMAIL_QUEUE_NAME = "email-send-queue";

export const emailQueue = new Queue<{ emailId: string }>(EMAIL_QUEUE_NAME, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 86400, count: 10000 },
    removeOnFail: { age: 604800, count: 10000 },
  },
});
