import type { ArchModelV2 } from "../arch/types.js";
import { buildKnowledge } from "../knowledge/build.js";
import { documentRules } from "../knowledge/documents.js";
import type { KnowledgeReport } from "../knowledge/types.js";
import type { KnowledgePayload } from "./types.js";

/** Les points d'entrée qu'une feature peut couvrir : tout sauf le fichier de démarrage et la ligne de commande. */
export const featureEntries = (model: ArchModelV2) =>
  [...new Set(model.nodes.flatMap((n) => (n.facets.entrypoints ?? []).filter((e) => e.kind !== "main" && e.kind !== "cli").map((e) => e.key)))];

const outdated = (r: KnowledgeReport) => new Set(r.concepts.flatMap((c) => c.claims.filter((k) => k.state !== "verified" && k.state !== "current" && k.state !== "unanchored").map((k) => k.id)));

/**
 * La connaissance déclarée dans `.vision/knowledge/`, son état recalculé
 * contre le code à chaque nouvelle carte. Le premier rapport sert de point
 * de départ : une note à jour au démarrage qui ne l'est plus est signalée.
 * Rien n'est écrit.
 */
export class KnowledgeSource {
  private current?: KnowledgePayload;
  private start?: Set<string>;

  constructor(private readonly root: string) {}

  get(model: ArchModelV2, builtAt: string): KnowledgePayload {
    if (this.current?.builtAt === builtAt) return this.current;
    const report = buildKnowledge(this.root, featureEntries(model));
    const now = outdated(report);
    this.start ??= now;
    this.current = { report, documents: documentRules(this.root), sinceStart: [...now].filter((id) => !this.start!.has(id)).sort(), builtAt };
    return this.current;
  }

  /** Les fichiers de connaissance et le code qu'ils ancrent : l'aperçu de code peut les ouvrir. */
  cited(builtAt: string): Set<string> {
    if (this.current?.builtAt !== builtAt) return new Set();
    return new Set([...this.current.report.concepts.flatMap((c) => [c.file, ...c.claims.flatMap((k) => k.anchors.flatMap((a) => (a.at ? [a.at.path] : [])))]), ...this.current.documents.map((d) => d.path)]);
  }
}
