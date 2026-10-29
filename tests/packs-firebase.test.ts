import { test } from "node:test";
import assert from "node:assert/strict";
import type { ArchModelV2 } from "../vision/arch/types.js";
import { mapOf } from "./pack-fixture.js";

const entries = (m: ArchModelV2, id: string) => (m.nodes.find((n) => n.id === id)?.facets.entrypoints ?? []).map((e) => `${e.kind} ${e.key}`).sort();
const triggers = (m: ArchModelV2) => m.edges.filter((e) => e.kind === "trigger").map((e) => `${e.from} > ${e.target?.entrypoint?.split(":").pop()}`).sort();

test("firebase : les codebases de firebase.json, les fonctions v1 et v2, leurs déclencheurs", async () => {
  const m = await mapOf({
    "firebase.json": JSON.stringify({ firestore: { rules: "firestore.rules" }, storage: { rules: "storage.rules" }, functions: [{ source: "functions", codebase: "default" }] }, null, 2),
    "functions/package.json": JSON.stringify({ name: "functions", main: "lib/index.js" }, null, 2),
    "functions/src/index.ts": `export { order, nightly } from "./v2";\nexport * from "./v1";\n`,
    "functions/src/v2.ts": [
      `import { onCall, onRequest } from "firebase-functions/v2/https";`,
      `import { onDocumentCreated } from "firebase-functions/v2/firestore";`,
      `import { onSchedule } from "firebase-functions/v2/scheduler";`,
      `import { onMessagePublished } from "firebase-functions/v2/pubsub";`,
      `import { onTaskDispatched } from "firebase-functions/v2/tasks";`,
      `import { onObjectFinalized } from "firebase-functions/v2/storage";`,
      `export const order = onCall({ region: "europe-west1" }, async (req) => ({ ok: true }));`,
      `export const hook = onRequest((req, res) => res.send("ok"));`,
      `export const onOrder = onDocumentCreated("users/{uid}/orders/{id}", async (e) => {});`,
      `export const nightly = onSchedule("every day 03:00", async () => {});`,
      `export const onJob = onMessagePublished({ topic: "jobs" }, async (e) => {});`,
      `export const render = onTaskDispatched(async (req) => {});`,
      `export const onUpload = onObjectFinalized(async (e) => {});`,
    ].join("\n"),
    "functions/src/v1.ts": [
      `import * as functions from "firebase-functions/v1";`,
      `const handle = async (data: unknown) => data;`,
      `export const legacy = functions.region("europe-west1").https.onCall(handle);`,
      `export const onCart = functions.firestore.document("carts/{id}").onWrite(async () => {});`,
      `export const weekly = functions.pubsub.schedule("every monday 09:00").onRun(async () => {});`,
      `exports.onSignup = functions.auth.user().onCreate(async () => {});`,
    ].join("\n"),
  });
  assert.equal(m.nodes.find((n) => n.id === "functions")?.role, "function");
  assert.deepEqual(entries(m, "functions"), [
    "event onCart", "event onOrder", "event onSignup", "event onUpload",
    "http hook", "main functions/src/index.ts",
    "message onJob", "message render",
    "rpc legacy", "rpc order",
    "schedule nightly", "schedule weekly",
  ]);
  // Le code d'une fonction : la fonction nommée qu'elle enveloppe, sinon sa déclaration.
  const legacy = m.nodes.find((n) => n.id === "functions")!.facets.entrypoints!.find((e) => e.key === "legacy")!;
  assert.deepEqual([legacy.handler?.path, legacy.handler?.name], ["functions/src/v1.ts", "handle"]);
  assert.deepEqual(triggers(m), ["cloudtasks > render", "firebasestorage > onUpload", "firestore > onCart", "firestore > onOrder", "pubsub > onJob"]);
  assert.deepEqual(m.nodes.filter((n) => n.role === "store").map((n) => n.tech?.[0]).sort(), ["firebasestorage", "firestore"]);
});

test("docker : le fichier lancé suit WORKDIR et COPY, depuis la racine du dépôt si besoin", async () => {
  const m = await mapOf({
    "packages/render/Dockerfile": [
      "FROM node:20",
      "WORKDIR /app",
      "COPY services/render/ /app/svc/",
      "WORKDIR /app/svc",
      'CMD ["npx", "tsx", "src/main.ts"]',
    ].join("\n"),
    "services/render/src/main.ts": `console.log("rendu");\n`,
  });
  const node = m.nodes.find((n) => n.id === "render");
  assert.equal(node?.subtitle, "services/render/src/main.ts");
});

test("node:http : les routes écrites à la main, avec leur méthode quand elle est comparée", async () => {
  const m = await mapOf({
    "Dockerfile": `FROM node:20\nCOPY . .\nCMD ["node", "server.js"]\n`,
    "server.js": [
      `import { createServer } from "node:http";`,
      `createServer((req, res) => {`,
      `  if (req.method === "POST" && req.url === "/render") return res.end();`,
      `  const url = new URL(req.url, "http://x");`,
      `  if (url.pathname === "/healthz") return res.end("ok");`,
      `  switch (req.url) { case "/metrics": return res.end(); }`,
      `}).listen(8080);`,
    ].join("\n"),
  });
  assert.deepEqual(entries(m, "image"), ["http ANY /healthz", "http ANY /metrics", "http POST /render", "main server.js"]);
});

test("firestore : chaque forme qui fabrique la base, et un chemin fabriqué dans un autre fichier", async () => {
  const m = await mapOf({
    "Dockerfile": `FROM node:20\nCOPY . .\nCMD ["node", "main.ts"]\n`,
    "main.ts": [`import "./web";`, `import "./admin";`, `import "./lazy";`, `import "./typed";`, `import "./param";`, `import "./klass";`, `import "./uses";`].join("\n"),
    // API modulaire : getFirestore() dans une constante
    "web.ts": [
      `import { getFirestore, doc, getDoc, collection, addDoc, query, where, getDocs } from "firebase/firestore";`,
      `const db = getFirestore();`,
      `export const read = (id: string) => getDoc(doc(db, "users", id));`,
      `export const write = (uid: string) => addDoc(collection(db, "users", uid, "orders"), {});`,
      `export const list = () => getDocs(query(collection(db, "products"), where("on", "==", true)));`,
    ].join("\n"),
    // Admin : admin.firestore() et une transaction
    "admin.ts": [
      `import * as admin from "firebase-admin";`,
      `const db = admin.firestore();`,
      `export const pay = (uid: string) => db.runTransaction(async (tx) => { const ref = db.collection("wallets").doc(uid); await tx.get(ref); tx.set(ref, {}); });`,
    ].join("\n"),
    // Singleton paresseux, exporté
    "lazy.ts": [
      `import { getFirestore, Firestore } from "firebase-admin/firestore";`,
      `let _db: Firestore | undefined;`,
      `export function db() { if (!_db) _db = getFirestore(); return _db; }`,
    ].join("\n"),
    // Fonction dont seul le type de retour dit qu'elle renvoie la base
    "typed.ts": [
      `import type { Firestore } from "@google-cloud/firestore";`,
      `import { container } from "./di";`,
      `export function store(): Firestore { return container.get("db"); }`,
    ].join("\n"),
    "di.ts": `export const container = { get: (k: string) => k as never };\n`,
    // Paramètre et propriété de classe
    "param.ts": [
      `import type { Firestore } from "firebase-admin/firestore";`,
      `export async function audit(db: Firestore) { await db.collection("audit").add({}); }`,
    ].join("\n"),
    "klass.ts": [
      `import { getFirestore } from "firebase-admin/firestore";`,
      `export class Repo { private db = getFirestore(); find(id: string) { return this.db.collection("repos").doc(id).get(); } }`,
    ].join("\n"),
    // Les fichiers qui utilisent ces bases importées, et un chemin fabriqué ailleurs
    "paths.ts": [`import { db } from "./lazy";`, `export function cartRef(uid: string) { return db().collection("users").doc(uid).collection("cart").doc("main"); }`].join("\n"),
    "uses.ts": [
      `import { db } from "./lazy";`,
      `import { store } from "./typed";`,
      `import { cartRef } from "./paths";`,
      `export const a = () => db().collection("sessions").get();`,
      `export const b = () => store().collection("logs").add({});`,
      `export const c = (uid: string) => cartRef(uid).get();`,
    ].join("\n"),
  });
  const access = m.edges.filter((e) => e.kind === "read" || e.kind === "write").map((e) => `${e.kind} ${e.target?.entity}`).sort();
  assert.deepEqual(access, [
    "read products", "read repos", "read sessions", "read users", "read users/{}/cart", "read wallets",
    "write audit", "write logs", "write users/{}/orders", "write wallets",
  ]);
});
