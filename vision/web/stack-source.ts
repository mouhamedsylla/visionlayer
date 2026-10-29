import { buildInfraModel } from "../infra/build.js";
import { buildModel } from "../model/build.js";
import { buildStackModel } from "../stack/build.js";
import type { StackModel } from "../stack/types.js";
import { iconOf } from "./icons.js";
import type { StackPayload, TechLabel } from "./types.js";

function labels(stack: StackModel): Record<string, TechLabel> {
  const out: Record<string, TechLabel> = {};
  for (const t of [...stack.languages, ...stack.technologies]) {
    const icon = iconOf(t.icon)?.path;
    out[t.id] = { name: t.name, category: "category" in t ? t.category : "language", ...(icon ? { icon } : {}) };
  }
  return out;
}

/**
 * L'inventaire des technologies (niveau Technologies, ADR 0011), calculé en
 * mémoire à la première lecture, puis seulement après une mise à jour de la
 * carte demandée par un humain : la carte dont il dépend est nommée par son
 * `builtAt`. Rien n'est écrit sur le disque.
 */
export class StackSource {
  private current?: StackPayload;

  constructor(private readonly root: string) {}

  get(builtAt: string): StackPayload {
    if (this.current?.builtAt === builtAt) return this.current;
    const stack = buildStackModel(this.root, buildModel(this.root), buildInfraModel(this.root));
    this.current = { stack, tech: labels(stack), builtAt };
    return this.current;
  }

  /** Les fichiers que l'inventaire cite à une ligne, s'il a été calculé pour cette carte. */
  cited(builtAt: string): Set<string> {
    if (this.current?.builtAt !== builtAt) return new Set();
    return new Set(this.current.stack.technologies.flatMap((t) => t.evidence.flatMap((e) =>
      e.kind === "files" || e.kind === "config" || e.line === undefined ? [] : [e.kind === "package" ? e.manifest : e.path])));
  }
}
