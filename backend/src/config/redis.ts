import IORedis from "ioredis";
import { createClient } from "redis";
import { env } from "./env";

export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

export const bullConnection = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: null as null,
};

// Dedicated Redis client for Express sessions.
// connect-redis requires the node-redis client.
export const sessionRedis = createClient({
  url: env.REDIS_URL,
});

sessionRedis.on("error", (error) => {
  console.error("Session Redis error:", error);
});

export const sessionRedisReady = sessionRedis.connect();