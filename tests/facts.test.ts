import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database, parseRules } from "../vision/facts/datalog.js";
import { FactBase } from "../vision/facts/base.js";
import { loadPack, loadPacks } from "../vision/facts/packs.js";
import { assemble } from "../vision/facts/assemble.js";
import { score } from "../vision/facts/score.js";
import { checkArchModelV2 } from "../vision/arch/schema.js";
import type { ArchModelV2 } from "../vision/arch/types.js";

const ATELIER = join(import.meta.dirname, "corpus", "atelier-api");
/** Constats de l'oracle déjà produits : monte à chaque détecteur ajouté (docs/fonctionnement/constats.md). */
const FINDINGS_FOUND = 14;
/**
 * Constats vrais, relus à la main le 01/10, que l'oracle n'a pas : deux fonctions de l'app web jamais importées ;
 * users.role « instructor » et « admin », lus mais écrits par aucun code ni aucune migration ; refunds.status « failed »,
 * écrit seulement dans payments ; requestReset, qui écrit le jeton puis publie l'email sans transaction commune.
 */
/** Montrés par la carte, absents de l'oracle, relus à la main dans le code : vrais, des oublis de l'oracle. */
const VERIFIED_EXTRA: Record<string, string[]> = {
  "points d'entrée": ["worker main src/email/main.ts"],
  "variables d'environnement (noms)": ["NODE_ENV", "VITE_STRIPE_PUBLISHABLE_KEY"],
  liens: [
    "api read postgres (instructors)", "api read postgres (sessions)",
    "worker read postgres (bookings)", "worker read postgres (slots)", "worker read postgres (workshops)",
  ],
  constats: [
    "dead_code web/src/api/auth.ts:6", "dead_code web/src/api/bookings.ts:15",
    "unused_value src/db/schema.ts:15", "unused_value src/db/schema.ts:15", "unused_value src/db/schema.ts:84",
    "write_then_enqueue src/auth/reset.ts:20",
  ],
};
const proof = (line: number) => ({ path: "x.ts", line, source: "syntax" as const });

test("règles : fermeture transitive, négation stratifiée, comparaisons, preuves transmises", () => {
  const db = new Database();
  db.add("depends", ["a", "b"], [proof(1)]);
  db.add("depends", ["b", "c"], [proof(2)]);
  db.add("depends", ["c", "a"], [proof(3)]);
  db.add("depends", ["d", "e"], [proof(4)]);
  db.add("start", ["a"]);
  db.run(parseRules(`
    reach(R, R) :- start(R).
    reach(R, H) :- reach(R, G), depends(G, H).   % les cycles ne bouclent pas
    unreached(F) :- depends(F, _), not reach("a", F).
    other(X, Y) :- depends(X, Y), X != "a", Y = "c".
  `));
  assert.deepEqual(db.get("reach").map((t) => t.args[1]), ["a", "b", "c"]);
  assert.deepEqual(db.get("unreached").map((t) => t.args[0]), ["d"]);
  assert.deepEqual(db.get("other").map((t) => t.args), [["b", "c"]]);
  // Le fait déduit garde les lignes qui l'ont produit.
  assert.deepEqual(db.get("reach").find((t) => t.args[1] === "c")!.proof.map((p) => p.line), [1, 2]);
});

test("règles : cat colle des chaînes liées, < compare des nombres, une récursion qui grandit s'arrête", () => {
  const db = new Database();
  db.add("mount", ["app", "/api", "users"]);
  db.add("mount", ["users", "/v1", "admin"]);
  db.add("route", ["admin", "GET", "/stats", 12]);
  db.add("guard", ["admin", 3]);
  db.add("loop", ["a", "a"]);
  db.run(parseRules(`
    prefix(app, "").
    prefix(C, P) :- prefix(R, P0), mount(R, Pre, C), P = cat(P0, Pre).
    key(K) :- route(R, M, Path, _), prefix(R, P), K = cat(M, " ", P, Path).
    guarded(R) :- route(R, _, _, L), guard(R, G), G < L.
    grow(S) :- loop(S, _).
    grow(T) :- grow(S), loop(_, _), T = cat(S, "a").
  `));
  assert.deepEqual(db.get("key").map((t) => t.args[0]), ["GET /api/v1/stats"]);
  assert.deepEqual(db.get("guarded").map((t) => t.args[0]), ["admin"]);
  assert.ok(db.get("grow").length <= 1000);
  assert.throws(() => parseRules("p(X) :- q(Y), X = cat(Y, Z)."), /n.est liée/);
  assert.throws(() => parseRules("p(cat(X, Y)) :- q(X, Y)."), /dans le corps/);
});

test("règles : une variable non liée, une négation en cycle, une syntaxe fautive sont refusées", () => {
  assert.throws(() => parseRules("p(X) :- q(Y)."), /variable X/);
  assert.throws(() => parseRules("p(X) :- q(X), not r(Z)."), /variable Z/);
  assert.throws(() => new Database().run(parseRules("p(X) :- q(X), not r(X).\nr(X) :- q(X), not p(X).")), /cycle/);
  assert.throws(() => parseRules("p(X) :- q(X)"), /« \. » attendu/);
});

test("packs : un champ inconnu ou une émission illisible sont refusés au chargement", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vision-pack-"));
  try {
    writeFileSync(join(dir, "bad.yaml"), "id: bad\nname: Bad\nfirestore: true\n");
    await assert.rejects(loadPack(join(dir, "bad.yaml")), /firestore/);
    writeFileSync(join(dir, "emit.yaml"), "id: emit\nname: Emit\nlanguages: [typescript]\nmatch:\n  - query: (identifier) @x\n    emit: pas une émission\n");
    await assert.rejects(loadPack(join(dir, "emit.yaml")), /émission illisible/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("base de faits : un fichier modifié est le seul relu, un fichier supprimé disparaît", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vision-facts-"));
  try {
    cpSync(ATELIER, dir, { recursive: true, filter: (src) => !src.includes("node_modules") });
    const packs = await loadPacks();
    const base = new FactBase(dir, packs);
    const first = base.refresh();
    assert.ok(first.read.length > 50);
    assert.equal(base.refresh().read.length, 0);

    // Depuis le cache, comme au lancement suivant de la commande.
    const again = new FactBase(dir, packs, JSON.parse(JSON.stringify(base.toCache())));
    const file = join(dir, "src", "bookings", "get.ts");
    writeFileSync(file, readFileSync(file, "utf8") + "\n// modifié\n");
    utimesSync(file, new Date(), new Date(Date.now() + 5000));
    unlinkSync(join(dir, "src", "import", "csv.ts"));
    const r = again.refresh();
    assert.deepEqual(r.read, ["src/bookings/get.ts"]);
    assert.deepEqual(r.removed, ["src/import/csv.ts"]);
    assert.equal(r.reused, first.read.length - 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("carte neutre d'atelier-api : produite par des règles, au niveau de l'oracle sauf les constats", async () => {
  const packs = await loadPacks();
  const base = new FactBase(ATELIER, packs);
  base.refresh();
  const model = assemble(base.database(), { name: "atelier-api", packs });
  assert.deepEqual(checkArchModelV2(model), []);
  const oracle = JSON.parse(readFileSync(join(ATELIER, "expected.arch.json"), "utf8")) as ArchModelV2;
  const lines = score(model, oracle);
  for (const l of lines) {
    if (l.what === "constats") { assert.equal(l.found, FINDINGS_FOUND, `constats : manque ${l.missing.join(" ; ")}`); continue; } //  à , détecteur par détecteur
    assert.equal(l.found, l.expected, `${l.what} : manque ${l.missing.join(" ; ")}`);
  }
  // Rien de montré que l'oracle n'a pas, sauf ce qui a été relu et trouvé vrai.
  for (const l of lines) assert.deepEqual([...l.extra].sort(), [...(VERIFIED_EXTRA[l.what] ?? [])].sort(), `${l.what} : en plus`);
  // Rien n'est vide « par manque de lecteur » : tout ce dépôt est lu.
  assert.ok(model.coverage.every((c) => c.read === c.total && c.gaps.length === 0), JSON.stringify(model.coverage));
});

test("carte neutre d'atelier-api : chaque point d'entrée dit ce qu'il exécute, lit, écrit et appelle", async () => {
  const packs = await loadPacks();
  const base = new FactBase(ATELIER, packs);
  base.refresh();
  const model = assemble(base.database(), { name: "atelier-api", packs });
  const effects = (id: string) => [...new Set(model.edges.filter((e) => e.occurrences.some((o) => o.entrypoints?.includes(id)))
    .map((e) => `${e.kind} ${e.to}${e.target?.entity ? ` ${e.target.entity}` : ""}`))].sort();
  const api = model.nodes.find((n) => n.id === "api")!;
  const pay = api.facets.entrypoints!.find((e) => e.key === "POST /payments")!;
  // La portée suit les appels : la garde de session est exécutée, l'ouverture d'une session (même fichier) ne l'est pas.
  assert.deepEqual(pay.files, ["src/auth/session.ts", "src/db.ts", "src/http.ts", "src/payments/create.ts", "src/payments/keys.ts", "src/stripe.ts"]);
  assert.deepEqual(effects(pay.id), [
    "read postgres bookings", "read postgres payments", "read postgres sessions", "read postgres users",
    "request stripe", "write postgres payments",
  ]);
  // Deux routes ne se partagent pas leurs effets : la santé ne lit rien.
  assert.deepEqual(effects("api:http:GET /healthz"), []);
  assert.deepEqual(effects("api:schedule:0 3 * * *"), ["write postgres sessions"]);
  // Les fonctions d'aide écrites au-dessus de la fonction de file comptent pour elle.
  assert.ok(effects("worker:message:emails").includes("read postgres bookings"), effects("worker:message:emails").join(" "));
});

test("carte neutre d'atelier-api : les contraintes d'unicité, les valeurs permises et le déclencheur de l'oracle", async () => {
  const packs = await loadPacks();
  const base = new FactBase(ATELIER, packs);
  base.refresh();
  const model = assemble(base.database(), { name: "atelier-api", packs });
  const oracle = JSON.parse(readFileSync(join(ATELIER, "expected.arch.json"), "utf8")) as ArchModelV2;
  const ents = (m: ArchModelV2) => m.nodes.flatMap((n) => n.facets.data?.entities ?? []);
  const uniques = (m: ArchModelV2) => ents(m).flatMap((e) => (e.constraints ?? []).filter((c) => c.kind === "unique")
    .map((c) => `${e.name} (${c.fields.join(", ")})${c.where ? ` où ${c.where}` : ""} ${c.proof.path}:${c.proof.line}`)).sort();
  assert.deepEqual(uniques(model), uniques(oracle));
  const triggers = (m: ArchModelV2) => ents(m).flatMap((e) => (e.triggers ?? []).map((t) => `${e.name} ${t.name} ${t.on.join("+")} ${t.proof.path}:${t.proof.line}`));
  assert.deepEqual(triggers(model), triggers(oracle));
  assert.deepEqual(ents(model).find((e) => e.name === "bookings")!.triggers![0]!.writes, ["audit_log"]);
  const status = (m: ArchModelV2) => ents(m).find((e) => e.name === "bookings")!.fields!.find((f) => f.name === "status")!.values;
  assert.deepEqual(status(model), status(oracle));
});

test("le moteur ne connaît aucune pile : les noms de technologies vivent dans les packs", () => {
  const dir = join(import.meta.dirname, "..", "vision", "facts");
  const words = /\b(express|firebase|firestore|stripe|postgres|redis|bullmq|drizzle|prisma|django|kafka|docker|fly)\b/i;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts"))) {
    const code = readFileSync(join(dir, f), "utf8").split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l));
    const hit = code.find((l) => words.test(l));
    assert.equal(hit, undefined, `${f} nomme une pile : ${hit}`);
  }
});

test("score : ce qui manque est non lu quand la couverture le dit, manqué sinon ; ce qui est en plus est compté", () => {
  const p = (path: string, line: number) => ({ path, line, source: "syntax" as const });
  const store = (entities: string[]): ArchModelV2["nodes"][number] => ({
    id: "db", name: "db", level: "deployable", role: "store", tech: ["postgresql"], status: "extracted", proof: [p("compose.yml", 3)],
    facets: { data: { entities: entities.map((name) => ({ name, proof: p(`src/${name}.py`, 1) })) } },
  } as ArchModelV2["nodes"][number]);
  const oracle: ArchModelV2 = { version: 2, system: { name: "x" }, nodes: [store(["users", "orders", "carts"])], edges: [], findings: [], coverage: [] };
  const found: ArchModelV2 = {
    version: 2, system: { name: "x" }, nodes: [store(["users", "logs"])], edges: [], findings: [],
    coverage: [{ level: "component", unit: "files", read: 1, total: 2, gaps: [{ kind: "language_not_read", subject: "fichiers .py", count: 1, where: [p("src/orders.py", 0)] }] }],
  };
  const l = score(found, oracle).find((x) => x.what === "entités")!;
  assert.equal(l.found, 1);
  assert.deepEqual(l.unread, ["db.orders"]);
  assert.deepEqual(l.missing.filter((m) => !l.unread.includes(m)), ["db.carts"]);
  assert.deepEqual(l.extra, ["db.logs"]);
});

test("carte neutre d'atelier-api : chaque valeur de bookings.status, la fonction qui l'écrit et son point d'entrée", async () => {
  const packs = await loadPacks();
  const base = new FactBase(ATELIER, packs);
  base.refresh();
  const model = assemble(base.database(), { name: "atelier-api", packs });
  const bookings = model.nodes.flatMap((n) => n.facets.data?.entities ?? []).find((e) => e.name === "bookings")!;
  assert.equal(bookings.group, "Réservations et paiements");
  const status = bookings.fields!.find((f) => f.name === "status")!;
  assert.equal(status.default, "pending");
  assert.deepEqual(status.writes!.map((w) => `${w.value} ${w.fn} ${w.entrypoints?.join(",")}`), [
    "confirmed confirmBooking api:http:POST /webhooks/stripe",
    "pending createBooking api:http:POST /bookings",
    "cancelled cancelBooking api:http:PATCH /bookings/:id",
    "cancelled expireHolds api:schedule:* * * * *",
    // markRefunded est dans le fichier de la route de remboursement, mais c'est le webhook qui l'importe.
    "refunded markRefunded api:http:POST /webhooks/stripe",
    "pending markPaymentFailed api:http:POST /webhooks/stripe",
  ]);
});

test("carte neutre d'atelier-api : le contrat d'envoi d'emails, ses champs commentés, ses fournisseurs et qui les choisit", async () => {
  const packs = await loadPacks();
  const base = new FactBase(ATELIER, packs);
  base.refresh();
  const model = assemble(base.database(), { name: "atelier-api", packs });
  assert.deepEqual(checkArchModelV2(model), []);
  const c = model.nodes.find((n) => n.id === "email")!.facets.contract![0]!;
  assert.match(c.summary!.text, /^Le code métier n'envoie jamais un email lui-même/);
  assert.equal(c.summary!.proof.path, "src/email/index.ts");
  const send = c.operations.find((o) => o.name === "send")!;
  assert.equal(send.request!.name, "EmailMessage");
  assert.equal(send.request!.fields.find((f) => f.name === "idempotencyKey")!.comment, "Même clé = même email : un job rejoué n'envoie pas deux fois.");
  assert.equal(send.request!.fields.find((f) => f.name === "replyTo")!.optional, true);
  assert.deepEqual(send.result!.fields.map((f) => f.name), ["id", "status", "retryable", "error", "raw"]);
  const byName = new Map(c.implementations.map((i) => [i.name, i]));
  assert.deepEqual(byName.get("ResendSender")!.calls!.map((x) => x.name), ["client.emails.send"]);
  assert.deepEqual(byName.get("SmtpSender")!.calls!.map((x) => x.name), ["transport.sendMail"]);
  assert.deepEqual(byName.get("ResendSender")!.packages, ["resend"]);
  assert.equal(byName.get("ResendSender")!.returns!.length, 2);
  assert.deepEqual(c.selector!.choices!.map((x) => [x.when ?? "défaut", x.implementation]), [["smtp", "SmtpSender"], ["console", "ConsoleSender"], ["défaut", "ResendSender"]]);
  assert.deepEqual(c.sealed, { packages: ["nodemailer", "resend"], leaks: [] });
});
