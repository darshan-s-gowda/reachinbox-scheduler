import { Client } from "@elastic/elasticsearch";
import { env } from "./env";

export const elasticsearch = new Client({ node: env.ELASTICSEARCH_URL });
export const EMAIL_INDEX = "emails";
