import { extname } from "node:path";
import { listProjectFiles } from "./files.js";
import type { RepositorySnapshot, Language } from "../model/types.js";

const EXTENSION_TO_LANGUAGE: Record<string, Language> = {
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "jsx",
  // Modules ES et CommonJS explicites (Node, configurations d'outils).
  ".mts": "typescript",
  ".cts": "typescript",
  ".mjs": "javascript",
  ".cjs": "javascript",
};

export function supportedExtensions(): string[] {
  return Object.keys(EXTENSION_TO_LANGUAGE);
}

export function languageFor(path: string): Language | undefined {
  return EXTENSION_TO_LANGUAGE[extname(path)];
}

/**
 * Découvre les fichiers sources supportés sous `root` : les fichiers du projet
 * au sens de git (`.gitignore` respecté, liens symboliques jamais suivis — cf.
 * files.ts), filtrés par extension.
 */
export function scan(root: string): RepositorySnapshot {
  const files = listProjectFiles(root)
    .map((f) => f.path)
    .filter((p) => languageFor(p));
  return { root, files };
}
