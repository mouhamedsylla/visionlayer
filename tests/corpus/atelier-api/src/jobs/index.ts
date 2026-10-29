import cron from "node-cron";
import { logger } from "../logger";
import { expireHolds } from "./expire";
import { purgeSessions } from "./purge";
import { sendReminders } from "./reminders";

const run = (name: string, fn: () => Promise<void>) => () => {
  fn().catch((err) => logger.error({ err, job: name }, "scheduled job failed"));
};

/** Les tâches planifiées tournent dans le processus de l'API. */
export function startCrons() {
  cron.schedule("* * * * *", run("expireHolds", expireHolds));
  cron.schedule("0 8 * * *", run("sendReminders", sendReminders), { timezone: "Europe/Paris" });
  cron.schedule("0 3 * * *", run("purgeSessions", purgeSessions));
}
