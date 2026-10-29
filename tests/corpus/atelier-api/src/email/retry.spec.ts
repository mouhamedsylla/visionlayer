import { describe, expect, it } from "vitest";
import { JOB_DEFAULTS, shouldRetry } from "./retry";

const result = (status: "sent" | "rejected", retryable: boolean) => ({ id: "", status, retryable, raw: null });

describe("shouldRetry", () => {
  it("réessaie une limite de débit ou une panne du fournisseur", () => {
    expect(shouldRetry(result("rejected", true))).toBe(true);
  });

  it("ne réessaie jamais une adresse refusée", () => {
    expect(shouldRetry(result("rejected", false))).toBe(false);
  });

  it("ne réessaie pas un email envoyé", () => {
    expect(shouldRetry(result("sent", false))).toBe(false);
  });

  it("garde cinq tentatives avec un délai qui double", () => {
    expect(JOB_DEFAULTS.attempts).toBe(5);
    expect(JOB_DEFAULTS.backoff).toEqual({ type: "exponential", delay: 30_000 });
  });
});
