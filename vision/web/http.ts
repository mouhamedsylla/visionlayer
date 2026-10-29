import { createReadStream, existsSync, statSync } from "node:fs";
import type { ServerResponse } from "node:http";
import { extname, join, normalize, sep } from "node:path";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
};

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

export function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

/**
 * Sert un fichier du build de l'interface. Un chemin qui sortirait du dossier
 * est refusé ; un chemin inconnu renvoie `index.html` (application d'une page).
 */
export function serveStatic(res: ServerResponse, dir: string, urlPath: string): void {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, "");
  const file = join(dir, rel);
  if (file !== dir && !file.startsWith(dir + sep)) return sendError(res, 403, "chemin refusé");
  const target = existsSync(file) && statSync(file).isFile() ? file : join(dir, "index.html");
  if (!existsSync(target)) return sendError(res, 404, "interface non construite : pnpm run ui:build");
  res.writeHead(200, { "content-type": TYPES[extname(target)] ?? "application/octet-stream" });
  createReadStream(target).pipe(res);
}
