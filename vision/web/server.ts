import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { sendError, sendJson, serveStatic } from "./http.js";
import { MapSource } from "./map-source.js";
import { projectInfo } from "./project.js";
import { readExcerpt, SourceError } from "./source.js";
import { DeploySource } from "./deploy-source.js";
import { KnowledgeSource } from "./knowledge-source.js";
import { StackSource } from "./stack-source.js";
import { PacksSource } from "./packs-source.js";
import { agentSessions } from "./agents-source.js";
import { SettingsSource } from "./settings-source.js";

export interface WebServerOptions {
  /** Le dépôt lu. */
  root: string;
  /** Le build de l'interface (`app/dist`). Absent en développement : Vite sert l'interface. */
  staticDir?: string;
}

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void> | void;

/**
 * Serveur local de l'interface (ADR 0009) : une lecture est un GET, une action
 * humaine est un POST. Il n'écoute que 127.0.0.1 (voir cli/ui.ts) et n'écrit
 * aucun fichier.
 */
export function createWebServer(opts: WebServerOptions): Server {
  const root = resolve(opts.root);
  const map = new MapSource(root);
  const stack = new StackSource(root);
  const deploy = new DeploySource(root);
  const knowledge = new KnowledgeSource(root);
  const packs = new PacksSource(root);
  const settings = new SettingsSource(root);
  const param = (req: IncomingMessage, name: string) => new URL(req.url ?? "/", "http://localhost").searchParams.get(name) ?? "";
  const agentParam = (req: Parameters<Handler>[0]) => { const a = param(req, "agent"); if (!["muse", "claude", "codex"].includes(a)) throw new Error(`agent inconnu : ${a}`); return a; };
  const routes: Record<string, Handler> = {
    "GET /api/project": (_req, res) => sendJson(res, 200, projectInfo(root)),
    "GET /api/agents": (_req, res) => sendJson(res, 200, agentSessions(root)),
    "GET /api/settings/agents": (_req, res) => sendJson(res, 200, settings.get()),
    "POST /api/settings/link": (req, res) => sendJson(res, 200, settings.link(agentParam(req))),
    "POST /api/settings/unlink": (req, res) => sendJson(res, 200, settings.unlink(agentParam(req))),
    "GET /api/map": async (_req, res) => sendJson(res, 200, await map.get()),
    "GET /api/stack": async (_req, res) => sendJson(res, 200, stack.get((await map.get()).builtAt)),
    "GET /api/deploy": async (_req, res) => sendJson(res, 200, await deploy.get((await map.get()).builtAt)),
    "GET /api/knowledge": async (_req, res) => {
      const { model, builtAt } = await map.get();
      sendJson(res, 200, knowledge.get(model, builtAt));
    },
    "POST /api/map/refresh": async (_req, res) => sendJson(res, 200, await map.refresh()),
    "GET /api/packs": async (_req, res) => sendJson(res, 200, await packs.get((await map.get()).packs)),
    // Les gestes humains de l'écran Packs : accepter recharge la carte avec le pack, refuser la laisse telle quelle.
    "POST /api/packs/accept": async (req, res) => { packs.accept(param(req, "id")); await map.refresh(); sendJson(res, 200, await packs.get((await map.get()).packs)); },
    "POST /api/packs/reject": async (req, res) => { packs.reject(param(req, "id")); sendJson(res, 200, await packs.get((await map.get()).packs)); },
    "POST /api/packs/write": async (req, res) => sendJson(res, 200, packs.write(param(req, "pkg"))),
    "GET /api/source": async (req, res) => {
      const q = new URL(req.url ?? "/", "http://localhost").searchParams;
      const path = q.get("path");
      if (!path) return sendError(res, 400, "paramètre path manquant");
      const from = Number(q.get("from") ?? 1) || 1;
      const { model, builtAt } = await map.get();
      sendJson(res, 200, readExcerpt(root, model, path, from, Number(q.get("to") ?? from) || from, new Set([...stack.cited(builtAt), ...deploy.cited(builtAt), ...knowledge.cited(builtAt)])));
    },
  };

  return createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const route = routes[`${req.method} ${path}`];
    try {
      if (route) return await route(req, res);
      if (path.startsWith("/api/")) return sendError(res, 404, "route inconnue");
      if (req.method !== "GET") return sendError(res, 405, "lecture seule");
      if (!opts.staticDir) return sendError(res, 404, "interface servie par Vite en développement");
      serveStatic(res, opts.staticDir, path);
    } catch (err) {
      if (err instanceof SourceError) return sendError(res, err.status, err.message);
      sendError(res, 500, err instanceof Error ? err.message : String(err));
    }
  });
}
