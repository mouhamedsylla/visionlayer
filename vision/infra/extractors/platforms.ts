import type { ExtractedFacts } from "../types.js";
import { ALL_ENVIRONMENTS, emptyFacts } from "../types.js";
import { componentId, isEnvVarName, lineOf, normalizeEnv, src } from "../common.js";

type Rec = Record<string, unknown>;
const asRec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** vercel.json : plateforme Vercel, réécritures/redirections (routes), régions, noms des variables `env`. */
export function extractVercel(path: string, content: string): ExtractedFacts {
  const facts = emptyFacts();
  const doc = asRec(JSON.parse(content));
  const id = componentId("platform", "vercel");
  const attrs: Record<string, string> = {};
  const regions = asList(doc.regions).map(String);
  if (regions.length) attrs.regions = regions.join(", ");
  if (typeof doc.framework === "string") attrs.framework = doc.framework;
  const rewrites = asList(doc.rewrites).map(asRec);
  const redirects = asList(doc.redirects).map(asRec);
  if (rewrites.length) attrs.rewrites = String(rewrites.length);
  if (redirects.length) attrs.redirects = String(redirects.length);
  const functions = Object.keys(asRec(doc.functions));
  if (functions.length) attrs.functions = functions.join(", ");
  const crons = asList(doc.crons).map(asRec);
  if (crons.length) attrs.crons = crons.map((c) => `${c.path} @ ${c.schedule}`).join(", ");
  facts.components.push({ id, name: "Vercel", kind: "platform", source: src(path, 1), environments: [ALL_ENVIRONMENTS], attrs });
  for (const r of rewrites) {
    const dest = String(r.destination ?? "");
    const m = dest.match(/^https?:\/\/([^/:]+)/);
    if (m) facts.links.push({ from: id, to: `name:${m[1]}`, kind: "routes_to", source: src(path, lineOf(content, String(r.source)) ?? 1), environments: [ALL_ENVIRONMENTS], label: String(r.source) });
  }
  for (const k of Object.keys({ ...asRec(doc.env), ...asRec(asRec(doc.build).env) })) if (isEnvVarName(k)) facts.envVars.push({ name: k, component: id, source: src(path, lineOf(content, `"${k}"`)), environments: [ALL_ENVIRONMENTS] });
  return facts;
}

/**
 * netlify.toml : plateforme Netlify, contextes (`[context.production]` →
 * environnement), redirections/proxys, fonctions, noms des variables.
 * Parseur TOML minimal (tables, tables de tableaux, clés simples).
 */
export function extractNetlify(path: string, content: string): ExtractedFacts {
  const facts = emptyFacts();
  const id = componentId("platform", "netlify");
  const attrs: Record<string, string> = {};
  const contexts = new Set<string>();
  const redirects: { from: string; to: string; line: number }[] = [];
  let table = "";
  let current: Record<string, string> | null = null;
  const perEnv: Record<string, Record<string, string>> = {};

  content.split("\n").forEach((raw, i) => {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) return;
    const arr = line.match(/^\[\[([^\]]+)\]\]$/);
    const tbl = line.match(/^\[([^\]]+)\]$/);
    if (arr) {
      table = arr[1]!.trim();
      current = {};
      if (table === "redirects") redirects.push({ from: "", to: "", line: i + 1 });
      return;
    }
    if (tbl) {
      table = tbl[1]!.trim();
      current = null;
      const ctx = table.match(/^context\.([^.]+)(?:\.environment)?$/);
      if (ctx) contexts.add(normalizeEnv(ctx[1]!));
      return;
    }
    const kv = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.*)$/);
    if (!kv) return;
    const key = kv[1]!;
    const value = kv[2]!.replace(/^"(.*)"$/, "$1");
    if (table === "redirects" && redirects.length) {
      const r = redirects[redirects.length - 1]!;
      if (key === "from") r.from = value;
      if (key === "to") r.to = value;
    } else if (table === "build") {
      if (key === "command" || key === "publish" || key === "functions") attrs[key] = value;
    } else if (/^context\.[^.]+\.environment$/.test(table)) {
      const env = normalizeEnv(table.split(".")[1]!);
      if (isEnvVarName(key)) facts.envVars.push({ name: key, component: id, source: src(path, i + 1), environments: [env] });
    } else if (table === "build.environment") {
      if (isEnvVarName(key)) facts.envVars.push({ name: key, component: id, source: src(path, i + 1), environments: [ALL_ENVIRONMENTS] });
    } else if (/^context\.[^.]+$/.test(table)) {
      const env = normalizeEnv(table.split(".")[1]!);
      (perEnv[env] ??= {})[key] = value;
    }
    void current;
  });

  if (contexts.size) attrs.contexts = [...contexts].join(", ");
  if (redirects.length) attrs.redirects = String(redirects.length);
  facts.components.push({ id, name: "Netlify", kind: "platform", source: src(path, 1), environments: [ALL_ENVIRONMENTS], attrs, ...(Object.keys(perEnv).length ? { perEnv } : {}) });
  for (const r of redirects) {
    const m = r.to.match(/^https?:\/\/([^/:]+)/);
    if (m) facts.links.push({ from: id, to: `name:${m[1]}`, kind: "routes_to", source: src(path, r.line), environments: [ALL_ENVIRONMENTS], label: r.from });
  }
  return facts;
}
