import type { JobsOptions } from "bullmq";
import type { SendResult } from "./types";

// par défaut : 5 tentatives, après 30 s puis 1, 2, 4, 8 min
export const JOB_DEFAULTS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 30_000 },
  removeOnComplete: 1000,
  removeOnFail: false,
};

/** Une adresse refusée ne se réessaie jamais ; une limite de débit ou une panne du fournisseur, si. */
export function shouldRetry(result: SendResult): boolean {
  return result.status === "rejected" && result.retryable;
}
