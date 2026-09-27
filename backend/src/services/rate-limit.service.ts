import { redis } from "../config/redis";
import { env } from "../config/env";
import { notifyRateLimit } from "./slack.service";

const RESERVE_SCRIPT = `
local count = redis.call('GET', KEYS[1])
if not count then count = 0 else count = tonumber(count) end
if count >= tonumber(ARGV[1]) then return 0 end
redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
return 1
`;

const DELAY_SCRIPT = `
local previous = redis.call('GET', KEYS[1])
local now = tonumber(ARGV[1])
local minDelay = tonumber(ARGV[2])
if not previous then
  redis.call('SET', KEYS[1], now, 'PX', minDelay + 10000)
  return 0
end
local wait = minDelay - (now - tonumber(previous))
if wait < 0 then wait = 0 end
local nextAt = now + wait
redis.call('SET', KEYS[1], nextAt, 'PX', minDelay + 10000)
return wait
`;

function hourKey(sender: string, at = new Date()) {
  const window = at.toISOString().slice(0, 13).replace("T", "-");
  return `rate:${sender}:${window}`;
}

export function nextHourTimestamp(now = Date.now()) {
  const date = new Date(now);
  date.setUTCMinutes(0, 0, 0);
  date.setUTCHours(date.getUTCHours() + 1);
  return date.getTime();
}

export async function reserveSendSlot(sender: string, userId: string, limit: number = env.MAX_EMAILS_PER_HOUR) {
  const now = Date.now();
  const key = hourKey(sender, new Date(now));
  const secondsLeft = Math.max(60, Math.ceil((nextHourTimestamp(now) - now) / 1000) + 60);
  const allowed = await redis.eval(RESERVE_SCRIPT, 1, key, limit, secondsLeft);

  if (Number(allowed) !== 1) {
    const notifyKey = `rate-notified:${key}`;
    const shouldNotify = await redis.set(notifyKey, "1", "EX", secondsLeft, "NX");
    if (shouldNotify) {
  try {
    await notifyRateLimit(userId, sender, limit);
  } catch (error) {
    console.error(
      "[rate-limit] Slack notification failed:",
      error instanceof Error ? error.message : "Unknown Slack error",
    );
  }
}
    return { allowed: false, retryAt: nextHourTimestamp(now) };
  }

  const delayKey = `delay:${sender}`;
  const wait = Number(await redis.eval(DELAY_SCRIPT, 1, delayKey, now, env.MIN_EMAIL_DELAY_MS));
  return { allowed: true, waitMs: wait, retryAt: now + wait };
}
