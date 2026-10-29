import type {
  ArchBlock, ArchEdge, ArchModel, ArchModelV2, ArchNode, Coverage, EdgeKind, EntryKind, EntryPoint,
  Entrypoint, EntrypointKind, Evidence, Finding, FindingCode, LinkKind, NodeRole, Occurrence, Proof,
} from "./types.js";

/**
 * Conversion de la carte v1 vers le modèle neutre v2 (ADR 0017, migration
 * étape 1). Elle ne lit aucun fichier et n'invente rien : chaque nœud, lien,
 * point d'entrée et constat vient d'un élément de la v1, avec sa preuve.
 * Elle disparaît quand l'extraction produit directement la v2 (RYP-190).
 */

export interface ToV2Options {
  /** Nom du système (le dossier du projet). */
  name: string;
  /** Tous les fichiers analysés, pour la couverture. Sans eux, le total vaut ce qui est lu. */
  files?: string[];
}

const ENTRY_KIND: Record<EntryKind, EntrypointKind> = {
  callable: "rpc", http: "http", trigger: "event", schedule: "schedule", task: "message", server: "main", app: "main",
};

const EDGE_KIND: Record<LinkKind, EdgeKind> = {
  calls: "call", reads: "read", writes: "write", triggers: "trigger", enqueues: "message", uses: "use", requests: "request",
};

/** Un fichier de configuration ou de déploiement, par opposition à du code lu dans son arbre syntaxique. */
const MANIFEST = /(^|\/)(Dockerfile[^/]*|[^/]+\.(json|ya?ml|toml|rules|html|sql|tf))$/i;

export function proofOf(e: Evidence): Proof {
  return { path: e.path, line: e.line, ...(e.text ? { text: e.text.slice(0, 200) } : {}), source: MANIFEST.test(e.path) ? "manifest" : "syntax" };
}

function occurrenceOf(e: Evidence, entrypoints?: string[]): Occurrence {
  return { ...proofOf(e), ...(entrypoints?.length ? { entrypoints } : {}) };
}

export function toV2(v1: ArchModel, opts: ToV2Options): ArchModelV2 {
  const entriesOf = new Map<string, EntryPoint[]>();
  for (const e of v1.entries) entriesOf.set(e.block, [...(entriesOf.get(e.block) ?? []), e]);

  // Qui appelle ou déclenche chaque point d'entrée : l'origine des liens qui le visent.
  const callers = new Map<string, Set<string>>();
  for (const l of v1.links) for (const t of l.targets) (callers.get(t) ?? callers.set(t, new Set()).get(t)!).add(l.from);

  const nodes: ArchNode[] = [];
  const edges: ArchEdge[] = [];
  /** Lecture/écriture vers un stockage dont on connaît les entités : remplacées par des liens par entité. */
  const byEntity = new Set<string>();

  for (const b of v1.blocks) {
    const entries = entriesOf.get(b.id) ?? [];
    const node: ArchNode = {
      id: b.id,
      name: b.name,
      ...placement(b, entries),
      ...(b.tech ? { tech: [b.tech] } : {}),
      ...(b.subtitle ? { subtitle: b.subtitle } : {}),
      status: "extracted",
      proof: [proofOf(b.origin)],
      ...(b.files.length ? { files: b.files } : {}),
      facets: {},
    };
    if (entries.length) node.facets.entrypoints = entries.map((e) => entrypointOf(e, callers.get(e.id)));

    const interior = b.interior;
    if (interior?.kind === "datastore") {
      byEntity.add(b.id);
      node.facets.data = {
        shape: "document",
        entities: interior.collections.map((c) => {
          const triggers = c.triggers.flatMap((id) => {
            const e = v1.entries.find((x) => x.id === id);
            return e ? [{ name: e.name, on: ["write" as const], proof: proofOf({ path: e.path, line: e.line, text: "" }) }] : [];
          });
          return { name: c.path, ...(c.rules ? { rule: proofOf(c.rules) } : {}), ...(triggers.length ? { triggers } : {}) };
        }),
      };
      for (const c of interior.collections) {
        for (const [kind, list] of [["read", c.reads], ["write", c.writes]] as const) {
          const from = new Map<string, Occurrence[]>();
          for (const a of list) from.set(a.block, [...(from.get(a.block) ?? []), occurrenceOf(a, a.entries)]);
          for (const [src, occurrences] of from) {
            edges.push({ id: `${src}>${kind}>${b.id}#${c.path}`, from: src, to: b.id, kind, target: { entity: c.path }, count: occurrences.length, occurrences });
          }
        }
      }
    } else if (interior?.kind === "queue") {
      node.facets.channel = {
        shape: b.tech === "googlecloud" && b.id.startsWith("queue:cloud-tasks") ? "task" : "queue",
        topics: interior.targets.map((t) => ({ name: t.label, proof: proofOf(t.evidence) })),
      };
    } else if (interior?.kind === "ai") {
      // Les fournisseurs deviennent des systèmes externes, appelés par la couche ; les modèles cités, des attributs.
      node.attributes = interior.models.flatMap((m) => m.evidence.slice(0, 1).map((e) => ({ key: "model", value: m.name, proof: proofOf(e) })));
      for (const p of interior.providers) {
        const id = `external:${p.tech}`;
        if (!nodes.some((n) => n.id === id) && !v1.blocks.some((x) => x.id === id)) {
          nodes.push({ id, name: p.name, level: "system", role: "external", tech: [p.tech], status: "extracted", proof: p.evidence.slice(0, 1).map(proofOf), facets: {} });
        }
        edges.push({ id: `${b.id}>request>${id}`, from: b.id, to: id, kind: "request", count: p.evidence.length, occurrences: p.evidence.slice(0, 60).map((e) => occurrenceOf(e)) });
      }
    } else if (interior?.kind === "external") {
      if (interior.urls.length) node.proof = [...node.proof, ...interior.urls.slice(0, 5).map(proofOf)];
    }
    if (b.id === "capability:auth") {
      node.facets.trust = { mechanisms: [{ name: "fournisseur d'identité", proof: proofOf(b.origin) }], exposure: "public" };
    }
    nodes.push(node);
  }

  for (const l of v1.links) {
    if ((l.kind === "reads" || l.kind === "writes") && byEntity.has(l.to)) continue;
    const kind = EDGE_KIND[l.kind];
    const target = l.targets.length === 1 ? { entrypoint: l.targets[0]! } : undefined;
    edges.push({ id: l.id, from: l.from, to: l.to, kind, ...(target ? { target } : {}), count: l.count, occurrences: l.evidence.map((e) => occurrenceOf(e, e.target ? [e.target] : undefined)) });
  }

  const findings: Finding[] = v1.warnings.map((w) => ({
    code: w.code as FindingCode,
    message: w.message,
    proof: w.evidence ? [proofOf(w.evidence)] : [],
    source: "syntax",
  }));

  return { version: 2, system: { name: opts.name }, nodes, edges, findings, coverage: coverageOf(v1, opts) };
}

function placement(b: ArchBlock, entries: EntryPoint[]): { level: ArchNode["level"]; role: NodeRole } {
  switch (b.kind) {
    case "client": return { level: "deployable", role: "app" };
    case "datastore": return { level: "deployable", role: "store" };
    case "queue": return { level: "deployable", role: "channel" };
    case "external": return { level: "system", role: "external" };
    case "capability": return b.interior?.kind === "ai" ? { level: "component", role: "layer" } : { level: "deployable", role: "managed" };
    case "service": {
      // Des points d'entrée sans processus qui écoute : des fonctions déployées une à une.
      const serves = entries.some((e) => e.kind === "server" || e.kind === "app");
      return { level: "deployable", role: entries.length && !serves ? "function" : "service" };
    }
  }
}

function entrypointOf(e: EntryPoint, calledBy?: Set<string>): Entrypoint {
  const [path, name] = e.symbol?.split("#") ?? [];
  return {
    id: e.id,
    kind: ENTRY_KIND[e.kind],
    key: e.name,
    ...(path && name ? { handler: { path, line: e.line, name } } : {}),
    proof: proofOf({ path: e.path, line: e.line, text: "" }),
    ...(calledBy?.size ? { calledBy: [...calledBy].sort() } : {}),
    ...(e.files ? { files: e.files } : {}),
    ...(e.ranges ? { ranges: e.ranges } : {}),
  };
}

/**
 * Ce que la v1 sait de ce qu'elle n'a pas lu : ses avertissements. Les fichiers
 * comptés sont ceux que l'analyse a ouverts ; un fichier qu'aucun bloc
 * n'exécute (script, maquette) a été lu, il n'est pas un trou. Les langages
 * non lus arrivent avec la base de faits (RYP-190).
 */
function coverageOf(v1: ArchModel, opts: ToV2Options): Coverage[] {
  const gaps: Coverage["gaps"] = [];
  const add = (kind: Coverage["gaps"][number]["kind"], subject: string, e?: Evidence) => {
    const g = gaps.find((x) => x.kind === kind && x.subject === subject);
    if (g) g.count++;
    else gaps.push({ kind, subject, count: 1, ...(e ? { proof: proofOf(e) } : {}) });
  };
  for (const w of v1.warnings) {
    if (w.code === "dynamic_path") add("path_dynamic", "chemin calculé à l'exécution", w.evidence);
    else if (w.code === "unresolved_target") add(/langage non analysé/.test(w.message) ? "language_not_read" : "target_unknown", w.message, w.evidence);
  }
  const files = opts.files?.length ?? new Set(v1.blocks.flatMap((b) => b.files)).size;
  return [{ level: "component", unit: "files", read: files, total: files, gaps }];
}
