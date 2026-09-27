import { Client } from "@elastic/elasticsearch";
import { env } from "./env";

export const elasticsearch = new Client({
  node: env.ELASTICSEARCH_URL,
  ...(env.ELASTICSEARCH_API_KEY
    ? { auth: { apiKey: env.ELASTICSEARCH_API_KEY } }
    : {}),
});
export const EMAIL_INDEX = "emails";
