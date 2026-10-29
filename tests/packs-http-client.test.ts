import { test } from "node:test";
import assert from "node:assert/strict";
import { factsOf, mapOf } from "./pack-fixture.js";

/** Une forme par cas, d'après docs/fonctionnement/packs/http-client.md (F = fetch, X = axios, E = enveloppes). */
test("http-client F1 à F7 : fetch", async () => {
  const calls = await factsOf({
    "f.ts": [
      `const API_URL = import.meta.env.VITE_API_URL;`,
      `export const a = () => fetch("/workshops");`,
      `export const b = () => fetch("/payments", { method: "POST" });`,
      `const init = { method: "DELETE" };`,
      "export const c = (id: string) => fetch(`/bookings/${id}`, init);",
      "export const d = (id: string) => fetch(`/bookings/${id}?full=1#top`);",
      "export const e = () => fetch(`${API_URL}/payments`, { method: \"post\" });",
      `export const g = () => fetch(API_URL + "/auth/login", { method: "POST" });`,
      `export const h = () => globalThis.fetch(new URL("/me", API_URL));`,
      `export const i = () => window.fetch(new Request("/sessions", { method: "PUT" }));`,
      `export const j = () => fetch("https://api.github.com/x");`,
      `const m = new Map(); m.get("/nope");`,
    ].join("\n"),
  }, "http_call");
  assert.deepEqual(calls, [
    "f.ts DELETE /bookings/:param 5", "f.ts GET /bookings/:param 6", "f.ts GET /me 9", "f.ts GET /workshops 2",
    "f.ts POST /auth/login 8", "f.ts POST /payments 3", "f.ts POST /payments 7", "f.ts PUT /sessions 10",
  ]);
});

test("http-client X1 à X6 : axios, ses instances, d'un fichier à l'autre", async () => {
  const calls = await factsOf({
    "http.ts": `import axios from "axios";\nexport const api = axios.create({ baseURL: "/api" });\nexport const ext = axios.create({ baseURL: process.env.API_URL });\n`,
    "index.ts": `export * from "./http";\n`,
    "x.ts": [
      `import http from "axios";`,
      `import { api as client, ext } from "./index";`,
      `const ax = require("axios");`,
      `export const a = () => http.get("/workshops");`,
      "export const b = () => http.delete(`/bookings/${1}`);",
      `export const c = () => http({ url: "/payments", method: "post" });`,
      `export const d = () => http("/me");`,
      `export const e = () => ax.request({ url: "/sessions", method: "PUT" });`,
      `export const f = () => client.post("/bookings", {});`,
      `export const g = () => ext.patch("/bookings/1");`,
      `const router = { get: (p: string) => p }; router.get("/nope");`,
    ].join("\n"),
  }, "http_call");
  assert.deepEqual(calls, [
    "x.ts DELETE /bookings/:param 5", "x.ts GET /me 7", "x.ts GET /workshops 4", "x.ts PATCH /bookings/1 10",
    "x.ts POST /api/bookings 9", "x.ts POST /payments 6", "x.ts PUT /sessions 8",
  ]);
});

test("http-client E1 à E5 : enveloppes, méthode en paramètre ou fixée, enveloppe d'enveloppe", async () => {
  const calls = await factsOf({
    "client.ts": [
      `const BASE = "";`,
      `export function api(path: string, init?: RequestInit) { return fetch(BASE + path, init); }`,
      `export function request(method: string, path: string) { return fetch(path, { method }); }`,
      `export const post = (path: string, body: unknown) => fetch(path, { method: "POST", body: JSON.stringify(body) });`,
      `export const getJson = (p: string) => api(p).then((r) => r.json());`,
      `import axios from "axios";`,
      `const inst = axios.create();`,
      `export const del = (path: string) => inst.delete(path);`,
    ].join("\n"),
    "w.ts": [
      `import { api, request, post, getJson, del as remove } from "./client";`,
      `export const a = () => api("/payments", { method: "POST" });`,
      `export const b = () => request("PATCH", "/bookings/:id");`,
      `export const c = () => post("/auth/signup", {});`,
      `export const d = () => getJson("/workshops");`,
      "export const e = () => remove(`/bookings/${1}`);",
      `function notWrapper(path: string) { return path.length; }`,
      `notWrapper("/nope");`,
    ].join("\n"),
  }, "http_call");
  assert.deepEqual(calls, [
    "w.ts DELETE /bookings/:param 6", "w.ts GET /workshops 5", "w.ts PATCH /bookings/:id 3", "w.ts POST /auth/signup 4", "w.ts POST /payments 2",
  ]);
});

test("http-client : l'appel relie le front à la route de l'API", async () => {
  const m = await mapOf({
    "api/Dockerfile": `FROM node:20\nCOPY . .\nCMD ["node", "server.ts"]\n`,
    "api/server.ts": `import express from "express";\nconst app = express();\napp.post("/payments", (_req, res) => res.end());\napp.listen(3000);\n`,
    "web/Dockerfile": `FROM node:20\nCOPY . .\nCMD ["node", "main.ts"]\n`,
    "web/main.ts": "const API = process.env.API_URL;\nexport const pay = () => fetch(`${API}/payments`, { method: \"POST\" });\n",
  });
  const route = m.nodes.flatMap((n) => n.facets.entrypoints ?? []).find((e) => e.key === "POST /payments");
  assert.equal(route?.calledBy?.length, 1);
});

test("http-client F8 F9 : l'adresse dans une constante ; une adresse illisible, non lue", async () => {
  const files = {
    "f.ts": [
      `const BACKEND = import.meta.env.VITE_BACKEND;`,
      "const GEN_URL = `${BACKEND}/generate`;",
      `const DOCS = "https://example.com/docs";`,
      `export const a = () => fetch(GEN_URL, { method: "POST" });`,
      `export const b = () => fetch(DOCS);`,
      `export const c = (u: string) => { const target = u.trim(); return fetch(target); };`,
      `export const d = (path: string) => fetch(BACKEND + path);`,
    ].join("\n"),
  };
  assert.deepEqual(await factsOf(files, "http_call"), ["f.ts POST /generate 4"]);
  // c : une adresse calculée ; d est une enveloppe, lue là où elle est appelée ; b, une adresse complète.
  assert.deepEqual(await factsOf(files, "http_unread"), ["f.ts 6"]);
});
