import { splitRoute } from "../block/resources";
import type { EntryRef } from "./list";

const ORDER = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/** Les méthodes HTTP d'un regroupement et combien de routes chacune : `GET ×2 · POST ×3`, dans l'ordre habituel. */
export function methodCounts(entries: EntryRef[]): { method: string; n: number }[] {
  const by = new Map<string, number>();
  for (const { entry } of entries) if (entry.kind === "http") {
    const m = splitRoute(entry.key).method || "ANY";
    by.set(m, (by.get(m) ?? 0) + 1);
  }
  const rank = (m: string) => (ORDER.includes(m) ? ORDER.indexOf(m) : ORDER.length);
  return [...by].map(([method, n]) => ({ method, n })).sort((a, b) => rank(a.method) - rank(b.method));
}
