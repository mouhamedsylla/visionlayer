import type { ArchModelV2, CodeFunction, Entity, Entrypoint, Finding, Proof } from "../arch/types.js";

/** Une adresse de code : `src/jobs/expire.ts:18`. */
export const at = (p: { path: string; line: number }) => `${p.path}:${p.line}`;

export interface IndexedEntry extends Entrypoint {
  node: string;
}

export interface IndexedEntity extends Entity {
  node: string;
}

/**
 * Les recherches dont le sommaire et la tranche ont besoin, posées une fois
 * sur la carte : qui contient une ligne, quel point d'entrée porte un nom,
 * où vit une table. Rien n'est déduit ici : tout vient des faits de la carte.
 */
export class MapIndex {
  readonly entries: IndexedEntry[];
  readonly entities: IndexedEntity[];
  readonly functions: CodeFunction[];
  readonly topics: { node: string; name: string; proof: Proof }[];

  constructor(readonly model: ArchModelV2) {
    this.entries = model.nodes.flatMap((n) => (n.facets.entrypoints ?? []).map((e) => ({ ...e, node: n.id })));
    this.entities = model.nodes.flatMap((n) => (n.facets.data?.entities ?? []).map((e) => ({ ...e, node: n.id })));
    this.functions = model.nodes.flatMap((n) => n.facets.functions ?? []);
    this.topics = model.nodes.flatMap((n) => (n.facets.channel?.topics ?? []).map((t) => ({ node: n.id, name: t.name, proof: t.proof })));
  }

  /** Le nom d'un nœud, tel que l'agent le lit (`docker (ingestion.worker)`), à la place de son identifiant. */
  nodeName(id: string): string {
    return this.model.nodes.find((n) => n.id === id)?.name ?? id;
  }

  /** Un bloc donné par son nom ou son identifiant. */
  nodeId(nameOrId: string): string {
    return this.model.nodes.find((n) => n.id === nameOrId || n.name === nameOrId)?.id ?? nameOrId;
  }

  /** La fonction du dépôt dont les lignes contiennent cette adresse (la plus courte si elles s'emboîtent). */
  functionAt(p: { path: string; line: number }): CodeFunction | undefined {
    return this.functions
      .filter((f) => f.proof.path === p.path && f.proof.line <= p.line && p.line <= f.end)
      .sort((a, b) => a.end - a.proof.line - (b.end - b.proof.line))[0];
  }

  functionNamed(name: string, path?: string): CodeFunction | undefined {
    const all = this.functions.filter((f) => f.name === name);
    return (path ? all.find((f) => f.proof.path === path) : undefined) ?? all[0];
  }

  /** Les occurrences des liens d'un genre vers une table ou une file. */
  occurrences(kind: "read" | "write" | "message", target: { entity?: string; topic?: string }) {
    return this.model.edges
      .filter((e) => e.kind === kind && (target.entity ? e.target?.entity === target.entity : e.target?.topic === target.topic))
      .flatMap((e) => e.occurrences.map((o) => ({ ...o, node: e.from })));
  }

  /** Le nom qu'un humain ou un agent emploie pour un point d'entrée : la route, sinon sa fonction, sinon sa clé. */
  entryName(e: Entrypoint): string {
    if (e.kind === "http" || e.kind === "main" || !e.handler?.name) return e.key;
    // Deux workers qui nomment tous deux leur fonction `processor` : la file ou la clé les distingue.
    const shared = this.entries.filter((o) => o.kind !== "http" && o.kind !== "main" && o.handler?.name === e.handler!.name).length > 1;
    return shared ? `${e.handler.name} (${e.key})` : e.handler.name;
  }

  entryById(id: string): IndexedEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  findingsOf(code: string): Finding[] {
    return this.model.findings.filter((f) => f.code === code);
  }
}
