import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { sendError, sendJson, serveStatic } from "./http.js";
import { createWebServer } from "./server.js";

/**
 * L'entrée du produit : choisir un projet, l'ouvrir, le lire. Chaque projet garde son serveur, sous `/p/<id>/`.
 *
 * En démonstration publique (`demo`) : les projets sont fixés, seule la question à Vigie s'exécute, et elle est bornée
 * par personne et par jour. Tout autre geste (écrire un pack, jouer un Replay, relier un agent) reste sur la machine de
 * l'utilisateur : il exécute du code ou modifie des fichiers.
 */
export interface HubProject { id: string; name: string; path: string; note?: string }
export interface HubOptions { staticDir?: string; projects?: HubProject[]; demo?: boolean; clones?: string }

const GITHUB = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+?(\.git)?\/?$/;
const PER_PERSON = 12, WINDOW_MS = 60 * 60_000, AT_ONCE = 4, PER_DAY = 300;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "projet";
const packageName = (dir: string) => { try { return (JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name?: string }).name; } catch { return undefined; } };

export function createHub(opts: HubOptions): Server {
  const clones = opts.clones ?? join(homedir(), ".visionlayer", "projects");
  const known = new Map<string, HubProject>((opts.projects ?? []).map((p) => [p.id, p]));
  const recentFile = join(homedir(), ".visionlayer", "recent.json");
  if (!opts.demo && existsSync(recentFile)) {
    try { for (const p of JSON.parse(readFileSync(recentFile, "utf8")) as HubProject[]) if (existsSync(p.path) && !known.has(p.id)) known.set(p.id, p); } catch { /* une liste illisible n'empêche pas de démarrer */ }
  }
  const servers = new Map<string, Server>();
  const remember = () => { if (opts.demo) return; mkdirSync(join(homedir(), ".visionlayer"), { recursive: true }); writeFileSync(recentFile, JSON.stringify([...known.values()], null, 2)); };
  const add = (path: string, note?: string): HubProject => {
    const abs = resolve(path);
    if (!existsSync(abs) || !statSync(abs).isDirectory()) throw new Error(`dossier introuvable : ${abs}`);
    const already = [...known.values()].find((p) => p.path === abs);
    if (already) return already;
    let id = slug(basename(abs));
    for (let i = 2; known.has(id); i++) id = `${slug(basename(abs))}-${i}`;
    const p: HubProject = { id, name: packageName(abs) ?? basename(abs), path: abs, ...(note ? { note } : {}) };
    known.set(id, p);
    remember();
    return p;
  };
  const serverOf = (p: HubProject) => servers.get(p.id) ?? servers.set(p.id, createWebServer({ root: p.path })).get(p.id)!;

  // Les bornes de la démonstration : par adresse, et le nombre de réponses en cours.
  const asked = new Map<string, number[]>();
  let running = 0;
  // Le plafond de la journée : quelques centimes la question, jamais plus que ce que le crédit peut tenir.
  let today = "", todayCount = 0;
  const who = (req: IncomingMessage) => String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "?").split(",")[0]!.trim();

  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    void handle(req, res, url).catch((err) => { if (!res.headersSent) sendError(res, 500, err instanceof Error ? err.message : String(err)); });
  });

  async function handle(req: IncomingMessage, res: ServerResponse, url: URL) {
    if (url.pathname === "/hub/projects") {
      return sendJson(res, 200, { demo: !!opts.demo, projects: [...known.values()].map((p) => ({ id: p.id, name: p.name, ...(p.note ? { note: p.note } : {}), ...(opts.demo ? {} : { path: p.path }) })) });
    }
    if (url.pathname === "/hub/open" && req.method === "POST") {
      if (opts.demo) return sendError(res, 403, "Démonstration : les projets sont fixés. Lance VisionLayer chez toi pour ouvrir le tien.");
      const target = (url.searchParams.get("target") ?? "").trim();
      if (!target) return sendError(res, 400, "indique un dossier ou une adresse GitHub");
      if (/^https?:\/\//.test(target)) {
        if (!GITHUB.test(target)) return sendError(res, 400, "seule une adresse https://github.com/propriétaire/dépôt est acceptée");
        const name = target.replace(/\.git\/?$|\/$/g, "").split("/").slice(-2).join("-");
        const dir = join(clones, slug(name));
        mkdirSync(clones, { recursive: true });
        // Le code est seulement lu : ni installé, ni exécuté.
        if (!existsSync(dir)) execFileSync("git", ["clone", "--quiet", "--depth", "1", target, dir], { timeout: 120_000 });
        return sendJson(res, 200, add(dir, target));
      }
      return sendJson(res, 200, add(target.replace(/^~/, homedir())));
    }
    const m = /^\/p\/([^/]+)(\/.*)?$/.exec(url.pathname);
    if (m) {
      const project = known.get(decodeURIComponent(m[1]!));
      if (!project) return sendError(res, 404, "projet inconnu");
      const rest = m[2] ?? "/";
      if (rest.startsWith("/api/")) {
        if (opts.demo && req.method !== "GET") {
          if (rest !== "/api/vigie/stream") return sendError(res, 403, "Démonstration en ligne : ce geste exécute du code ou modifie des fichiers. Il tourne quand VisionLayer est lancé sur ton projet.");
          const ip = who(req), now = Date.now();
          const recent = (asked.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
          if (recent.length >= PER_PERSON) return sendError(res, 429, "Limite de la démonstration : réessaie dans une heure, ou lance VisionLayer sur ton projet.");
          const day = new Date().toISOString().slice(0, 10);
          if (day !== today) { today = day; todayCount = 0; }
          if (todayCount >= PER_DAY) return sendError(res, 429, "La démonstration a atteint sa limite du jour : lance VisionLayer sur ton projet, ou reviens demain.");
          todayCount++;
          if (running >= AT_ONCE) return sendError(res, 503, "Vigie répond déjà à plusieurs personnes : réessaie dans une minute.");
          asked.set(ip, [...recent, now]);
          running++;
          res.once("close", () => { running--; });
        }
        req.url = rest + url.search;
        serverOf(project).emit("request", req, res);
        return;
      }
      if (!opts.staticDir) return sendError(res, 404, "interface non construite : pnpm app:build");
      return serveStatic(res, opts.staticDir, rest);
    }
    if (!opts.staticDir) return sendError(res, 404, "interface non construite : pnpm app:build");
    serveStatic(res, opts.staticDir, url.pathname);
  }
}

/** Les projets d'un dossier de démonstration : un sous-dossier par projet, avec `demo.json` pour son nom et sa note. */
export function demoProjects(dir: string): HubProject[] {
  return readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory()).sort().map((d) => {
    const path = join(dir, d);
    let meta: { name?: string; note?: string } = {};
    try { meta = JSON.parse(readFileSync(join(path, "demo.json"), "utf8")); } catch { /* sans description */ }
    return { id: slug(d), name: meta.name ?? d, path, ...(meta.note ? { note: meta.note } : {}) };
  });
}
