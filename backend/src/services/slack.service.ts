import { WebClient } from "@slack/web-api";
import { prisma } from "../config/database";
import { decryptSecret } from "../utils/secrets";

export async function notifyRateLimit(
  userId: string,
  sender: string,
  limit: number,
) {
  const connection = await prisma.slackConnection.findUnique({
    where: { userId },
  });

  if (!connection) return;

  const text = `ReachInbox rate limit reached: sender ${sender} hit the hourly limit of ${limit} emails. Remaining jobs were deferred to the next available window.`;

  // Prefer Slack OAuth + channel when available.
  if (connection.channelId) {
    const client = new WebClient(
      decryptSecret(connection.accessToken),
    );

    await client.chat.postMessage({
      channel: connection.channelId,
      text,
    });

    return;
  }

  // Fallback to an incoming webhook when no channel is available.
  if (connection.webhookUrl) {
    const webhookUrl = decryptSecret(connection.webhookUrl);

    if (!webhookUrl.startsWith("https://hooks.slack.com/")) {
      throw new Error("Invalid Slack webhook URL");
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(
        `Slack webhook notification failed: ${response.status}`,
      );
    }

    return;
  }
}