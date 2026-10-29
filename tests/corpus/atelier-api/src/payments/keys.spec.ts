import { describe, expect, it } from "vitest";
import { paymentKey } from "./keys";

describe("paymentKey", () => {
  it("donne la même clé pour deux clics sur la même réservation", () => {
    expect(paymentKey("b-1")).toBe(paymentKey("b-1"));
  });

  it("donne des clés différentes pour deux réservations", () => {
    expect(paymentKey("b-1")).not.toBe(paymentKey("b-2"));
  });
});
