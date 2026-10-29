import { parse as parseYaml } from "yaml";
import type { ExtractedFacts, InfraLink } from "../types.js";
import { emptyFacts } from "../types.js";
import { componentId, envsOf, lineOf, src } from "../common.js";

/** Bloc nginx : `name args { ... }` ou directive `name args;`. */
interface Block {
  name: string;
  args: string[];
  line: number;
  children: Block[];
}

/** Parseur nginx minimal (blocs et directives ; commentaires `#` ignorés). */
export function parseNginx(content: string): Block[] {
  const text = content.replace(/#[^\n]*/g, (m) => " ".repeat(m.length));
  const tokens: { t: string; line: number }[] = [];
  let line = 1;
  let cur = "";
  let quote: string | null = null;
  const push = () => {
    if (cur) tokens.push({ t: cur, line });
    cur = "";
  };
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      if (ch === "\n") line++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "\n") {
      push();
      line++;
      continue;
    }
    if (/\s/.test(ch)) {
      push();
      continue;
    }
    if (ch === "{" || ch === "}" || ch === ";") {
      push();
      tokens.push({ t: ch, line });
      continue;
    }
    cur += ch;
  }
  push();

  let i = 0;
  function parseBlock(): Block[] {
    const out: Block[] = [];
    while (i < tokens.length) {
      const tok = tokens[i]!;
      if (tok.t === "}") {
        i++;
        return out;
      }
      const name = tok.t;
      const startLine = tok.line;
      i++;
      const args: string[] = [];
      while (i < tokens.length && tokens[i]!.t !== ";" && tokens[i]!.t !== "{" && tokens[i]!.t !== "}") args.push(tokens[i++]!.t);
      if (i < tokens.length && tokens[i]!.t === "{") {
        i++;
        out.push({ name, args, line: startLine, children: parseBlock() });
      } else {
        if (i < tokens.length && tokens[i]!.t === ";") i++;
        out.push({ name, args, line: startLine, children: [] });
      }
    }
    return out;
  }
  return parseBlock();
}

function walk(blocks: Block[], fn: (b: Block, parents: Block[]) => void, parents: Block[] = []): void {
  for (const b of blocks) {
    fn(b, parents);
    walk(b.children, fn, [...parents, b]);
  }
}

/** Cible d'un `proxy_pass http://api:3000/` → `api` (nom d'upstream ou d'hôte). */
function proxyTargetName(url: string): string {
  const m = url.match(/^[a-z]+:\/\/([^/:$]+)/i);
  return m ? m[1]! : url.replace(/^\$/, "");
}

/**
 * nginx.conf : un composant `proxy` par fichier, ses domaines (`server_name`),
 * ports (`listen`), et un lien `routes_to` par `proxy_pass`, résolu vers un
 * upstream déclaré ou directement vers un hôte (= nom de service compose).
 */
export function extractNginx(path: string, content: string, environment: string | undefined): ExtractedFacts {
  const facts = emptyFacts();
  const envs = envsOf(environment);
  const blocks = parseNginx(content);
  const proxyId = componentId("proxy", "nginx");
  const upstreams = new Map<string, string[]>();
  const domains = new Set<string>();
  const listens = new Set<string>();
  let tls = false;
  const routes: { host: string; location: string; target: string; line: number }[] = [];

  walk(blocks, (b, parents) => {
    if (b.name === "upstream" && b.args[0]) {
      upstreams.set(b.args[0], b.children.filter((c) => c.name === "server").map((c) => c.args[0] ?? "?"));
    }
    if (b.name === "server_name") for (const d of b.args) if (d !== "_") domains.add(d);
    if (b.name === "listen") {
      listens.add(b.args[0] ?? "?");
      if (b.args.includes("ssl")) tls = true;
    }
    if (b.name === "ssl_certificate") tls = true;
    if (b.name === "proxy_pass" && b.args[0]) {
      const location = parents.find((p) => p.name === "location");
      const server = parents.find((p) => p.name === "server");
      const host = server?.children.find((c) => c.name === "server_name")?.args[0] ?? "";
      routes.push({ host, location: location?.args.filter((a) => !a.startsWith("~") && a !== "=").pop() ?? "/", target: proxyTargetName(b.args[0]), line: b.line });
    }
  });

  const attrs: Record<string, string> = {};
  if (domains.size) attrs.domains = [...domains].join(", ");
  if (listens.size) attrs.listen = [...listens].join(", ");
  attrs.tls = tls ? "oui" : "non";
  if (upstreams.size) attrs.upstreams = [...upstreams.entries()].map(([n, s]) => `${n} → ${s.join(", ")}`).join(" ; ");

  facts.components.push({ id: proxyId, name: "nginx", kind: "proxy", source: src(path, lineOf(content, /^\s*(http|server|events)\s*\{/m) ?? 1), environments: envs, attrs });

  const seen = new Set<string>();
  for (const r of routes) {
    const servers = upstreams.get(r.target) ?? [r.target];
    for (const s of servers) {
      const hostName = s.split(":")[0]!;
      const label = `${r.host ? r.host : ""}${r.location}`;
      const key = `${hostName}|${label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // La cible est un nom de service (compose/k8s) : l'id définitif est résolu à la fusion (build.ts) par nom.
      const link: InfraLink = { from: proxyId, to: `name:${hostName}`, kind: "routes_to", source: src(path, r.line), environments: envs, label };
      facts.links.push(link);
    }
  }
  return facts;
}

/** Caddyfile : chaque bloc de site `domaine { reverse_proxy cible }` → domaines + routes. */
export function extractCaddy(path: string, content: string, environment: string | undefined): ExtractedFacts {
  const facts = emptyFacts();
  const envs = envsOf(environment);
  const proxyId = componentId("proxy", "caddy");
  const domains: string[] = [];
  const lines = content.split("\n");
  let currentSite: string | null = null;
  let depth = 0;
  lines.forEach((raw, i) => {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) return;
    if (depth === 0 && line.endsWith("{")) {
      currentSite = line.slice(0, -1).trim();
      if (currentSite && !currentSite.startsWith("(") && !currentSite.startsWith(":") && currentSite !== "") domains.push(...currentSite.split(/[,\s]+/).filter(Boolean));
    }
    const rp = line.match(/^(?:handle\S*\s+\S+\s*\{\s*)?reverse_proxy\s+(?:\/\S*\s+)?(\S+)/);
    if (rp && currentSite) {
      const target = rp[1]!.replace(/^https?:\/\//, "").split(":")[0]!;
      facts.links.push({ from: proxyId, to: `name:${target}`, kind: "routes_to", source: src(path, i + 1), environments: envs, label: currentSite });
    }
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
    if (depth === 0 && line.includes("}")) currentSite = null;
  });
  const attrs: Record<string, string> = { tls: "auto (Caddy)" };
  if (domains.length) attrs.domains = domains.join(", ");
  facts.components.push({ id: proxyId, name: "caddy", kind: "proxy", source: src(path, 1), environments: envs, attrs });
  return facts;
}

/** traefik.yml (config statique) : points d'entrée et résolveur TLS. Les routes viennent des labels compose. */
export function extractTraefik(path: string, content: string, environment: string | undefined): ExtractedFacts {
  const facts = emptyFacts();
  const envs = envsOf(environment);
  const doc = (parseYaml(content) ?? {}) as Record<string, unknown>;
  const attrs: Record<string, string> = {};
  const entryPoints = doc.entryPoints as Record<string, { address?: string }> | undefined;
  if (entryPoints) attrs.entrypoints = Object.entries(entryPoints).map(([n, e]) => `${n}${e?.address ? ` (${e.address})` : ""}`).join(", ");
  const resolvers = doc.certificatesResolvers as Record<string, unknown> | undefined;
  attrs.tls = resolvers ? `oui (${Object.keys(resolvers).join(", ")})` : "non";
  const providers = doc.providers as Record<string, unknown> | undefined;
  if (providers) attrs.providers = Object.keys(providers).join(", ");
  facts.components.push({ id: componentId("proxy", "traefik"), name: "traefik", kind: "proxy", source: src(path, 1), environments: envs, attrs });
  return facts;
}
