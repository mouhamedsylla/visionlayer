import type { ExtractedFacts } from "../types.js";
import { ALL_ENVIRONMENTS, emptyFacts } from "../types.js";
import { isEnvVarName, src } from "../common.js";

/**
 * Dockerfile : un composant `image` (identifié par le chemin du fichier, ce
 * qui permet à compose de s'y relier via `build`), avec image de base, ports
 * exposés, et noms des ARG/ENV.
 */
export function extractDockerfile(path: string, content: string): ExtractedFacts {
  const facts = emptyFacts();
  const lines = logicalLines(content);
  const attrs: Record<string, string> = {};
  const from: string[] = [];
  const expose: string[] = [];
  const stages: string[] = [];
  let firstLine: number | undefined;

  lines.forEach(({ text: raw, line: i }) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const [instr, ...rest] = line.split(/\s+/);
    const arg = rest.join(" ");
    switch (instr!.toUpperCase()) {
      case "FROM": {
        firstLine ??= i + 1;
        const m = arg.match(/^(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?/i);
        if (m) {
          from.push(m[1]!);
          if (m[2]) stages.push(m[2]);
        }
        break;
      }
      case "EXPOSE":
        expose.push(...arg.split(/\s+/));
        break;
      case "ARG":
      case "ENV": {
        // `ENV A=1 B=2`, ou la forme historique `ENV A 1` (une seule variable).
        const tokens = /^[A-Za-z_][A-Za-z0-9_]*=/.test(arg) ? arg.split(/\s+(?=[A-Za-z_][A-Za-z0-9_]*=)/) : [arg];
        for (const token of tokens) {
          const name = token.split(/[=\s]/)[0]!.trim();
          if (isEnvVarName(name)) facts.envVars.push({ name, component: `image:${path}`, source: src(path, i + 1), environments: [ALL_ENVIRONMENTS] });
        }
        break;
      }
      case "USER":
        attrs.user = arg;
        break;
      case "WORKDIR":
        attrs.workdir = arg;
        break;
      case "CMD":
      case "ENTRYPOINT":
        attrs[instr!.toLowerCase()] = arg;
        break;
    }
  });

  const bases = [...new Set(from.filter((f) => !stages.includes(f)))];
  if (bases.length) attrs.base = bases.join(" → ");
  if (stages.length) attrs.stages = stages.join(", ");
  if (expose.length) attrs.expose = expose.join(", ");

  facts.components.push({
    id: `image:${path}`,
    name: path,
    kind: "image",
    source: src(path, firstLine),
    environments: [ALL_ENVIRONMENTS],
    attrs,
  });
  return facts;
}

/**
 * Instructions Dockerfile : une ligne terminée par une barre oblique inverse
 * est jointe à la suivante (`ENV A=1 …` puis `B=2`), les commentaires
 * intercalés ignorés.
 * `line` est l'index (0-based) de la première ligne de l'instruction.
 */
function logicalLines(content: string): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = [];
  let current: { text: string; line: number } | null = null;
  content.split("\n").forEach((raw, i) => {
    const trimmed = raw.trim();
    if (current && trimmed.startsWith("#")) return;
    const continued = /\\\s*$/.test(raw);
    const piece = raw.replace(/\\\s*$/, " ");
    if (current) current.text += ` ${piece.trim()}`;
    else current = { text: piece, line: i };
    if (!continued) {
      out.push(current);
      current = null;
    }
  });
  if (current) out.push(current);
  return out;
}
