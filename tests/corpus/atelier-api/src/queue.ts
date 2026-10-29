import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";
import type { EmailJob } from "./email/types";
import { JOB_DEFAULTS } from "./email/retry";

export const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const emailQueue = new Queue<EmailJob>("emails", { connection, defaultJobOptions: JOB_DEFAULTS });
