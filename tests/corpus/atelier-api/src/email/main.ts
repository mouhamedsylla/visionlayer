import { Worker } from "bullmq";
import { logger } from "../logger";
import { connection } from "../queue";
import { sendEmail } from "./worker";

const worker = new Worker("emails", sendEmail, { connection, concurrency: 5 });

worker.on("failed", (job, err) => logger.warn({ jobId: job?.id, template: job?.data.template, err: err.message }, "email failed"));
logger.info("email worker started");
