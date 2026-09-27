import app from "./app";
import { env } from "./config/env";
import { prisma } from "./config/database";
import { redis } from "./config/redis";
import { elasticsearch } from "./config/elasticsearch";
import "./queue/email.worker";
import { ensureEmailIndex } from "./services/search.service";

async function bootstrap() {
  await prisma.$connect();
  await redis.ping();
  await elasticsearch.ping();
  await ensureEmailIndex();

  const server = app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
    console.log(`Bull Board: http://localhost:${env.PORT}/admin/queues`);
  });

  const shutdown = async () => {
    server.close();
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
  console.error("Failed to start:", error);
  process.exit(1);
});
