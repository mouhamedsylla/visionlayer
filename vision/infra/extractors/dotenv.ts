import type { ExtractedFacts } from "../types.js";
import { emptyFacts } from "../types.js";
import { envsOf, isEnvVarName, src } from "../common.js";

/**
 * `.env.example`, `.env.production`… : NOMS des variables uniquement. Les
 * valeurs ne sont jamais lues au-delà du `=`. L'environnement
 * vient du suffixe du fichier ; `.env.example`/`.env.sample` valent pour tous.
 */
export function extractDotenv(path: string, content: string, environment: string | undefined): ExtractedFacts {
  const facts = emptyFacts();
  const envs = envsOf(environment);
  content.split("\n").forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const name = line.replace(/^export\s+/, "").split("=")[0]!.trim();
    if (isEnvVarName(name)) facts.envVars.push({ name, source: src(path, i + 1), environments: envs });
  });
  return facts;
}
