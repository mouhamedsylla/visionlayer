import { describe, expect, it } from "vitest";
import { credentialStores, openers } from "../src/domain/identity/credentials";
import { accessRows, accessUnread } from "../src/domain/identity/guards";
import { atelierMap } from "./atelier";

describe("Identité, sur atelier-api", async () => {
  const { model } = await atelierMap();
  const { rows, guards, unread } = accessRows(model);

  it("range les routes par garde, du plus ouvert au plus fermé", () => {
    expect(rows.map((r) => `${r.level} ${r.entries.length}`)).toEqual(["public 6", "signature 1", "authenticated 7", "role 1"]);
    expect(unread).toEqual([]);
  });

  it("nomme les fonctions qui gardent, leurs refus et ce qu'elles lisent", () => {
    expect(guards.map((g) => `${g.ref.name} ${g.level} ${g.entries.length}`)).toEqual(["requireUser authenticated 7", "requireAdmin role 1"]);
    const user = guards.find((g) => g.ref.name === "requireUser")!;
    expect(user.refusals.map((r) => `${r.status} ${r.code}`)).toEqual(["401 unauthenticated"]);
    expect(user.reads.map((r) => r.entity).sort()).toEqual(["sessions", "users"]);
    const admin = guards.find((g) => g.ref.name === "requireAdmin")!;
    expect(admin.refusals.map((r) => `${r.status} ${r.code}`)).toEqual(["401 unauthenticated", "403 forbidden"]);
  });

  it("dit ce qu'une route vérifie elle-même sur l'appelant reconnu", () => {
    const get = rows.flatMap((r) => r.entries).find((e) => e.entry.key === "GET /bookings/:id")!;
    expect(get.checks.map((c) => `${c.status} ${c.code}`)).toEqual(["404 not_found"]);
    const exp = rows.flatMap((r) => r.entries).find((e) => e.entry.key === "GET /admin/export")!;
    expect(exp.checks).toEqual([]);
  });

  it("montre qui écrit ce que la garde lit, et où l'on obtient sa preuve", () => {
    const stores = credentialStores(model, guards);
    const sessions = stores.find((s) => s.entity === "sessions")!;
    expect(sessions.writes.map((w) => `${w.item.entry.key} ${w.fn}`).sort()).toEqual(["0 3 * * * purgeSessions", "POST /auth/login openSession", "POST /auth/signup openSession"]);
    expect(openers(stores).map((e) => e.entry.key)).toEqual(["POST /auth/login", "POST /auth/signup"]);
  });

  it("dit ce que les routes publiques écrivent", () => {
    const pub = rows.find((r) => r.level === "public")!.entries.filter((e) => e.writes.length);
    expect(pub.map((e) => `${e.entry.key}: ${e.writes.join(", ")}`)).toEqual([
      "POST /auth/signup: users, sessions", "POST /auth/login: sessions", "POST /auth/reset: password_resets",
    ]);
  });

  it("grise l'entrée Accès quand aucune garde n'est lue, sans dire le système ouvert", () => {
    expect(accessUnread(model)).toBeUndefined();
    const bare = { ...model, nodes: model.nodes.map((n) => ({ ...n, facets: { ...n.facets, entrypoints: n.facets.entrypoints?.map(({ access: _, ...e }) => e) } })) };
    expect(accessUnread(bare)).toBe("aucun pack ne lit encore les gardes de ce projet");
  });
});
