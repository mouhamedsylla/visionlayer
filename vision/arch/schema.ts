import { z } from "zod";
import type { ArchModelV2 } from "./types.js";

/**
 * Schéma strict du modèle neutre (ADR 0017). Tout champ inconnu est refusé :
 * un `collections` ou un `bullmq` glissé dans un nœud échoue à la validation,
 * pas en revue. Le type `ArchModelV2` et ce schéma doivent rester identiques ;
 * la vérification en bas du fichier casse la compilation sinon.
 */

const S = z.strictObject;

const source = z.enum(["syntax", "symbols", "manifest", "pack", "runtime", "declared"]);
const level = z.enum(["system", "deployable", "component", "code"]);
const edgeKind = z.enum(["call", "read", "write", "message", "request", "trigger", "use", "deploy"]);

const proof = S({
  path: z.string().min(1),
  line: z.number().int().nonnegative(),
  text: z.string().max(200).optional(),
  source,
  pack: z.string().optional(),
});

const symbolRef = S({ path: z.string().min(1), line: z.number().int().positive(), name: z.string().min(1) });

const guard = S({
  level: z.enum(["public", "authenticated", "role", "signature", "internal", "unknown"]),
  roles: z.array(z.string()).optional(),
  proof: proof.optional(),
  by: symbolRef.optional(),
});

const flowStep = S({
  kind: z.enum(["call", "read", "write", "message", "request", "trigger", "use", "deploy", "invoke", "refuse", "return", "reply"]),
  depth: z.number().int().nonnegative(),
  proof,
  target: S({ node: z.string().min(1), entity: z.string().optional(), topic: z.string().optional() }).optional(),
  name: z.string().optional(),
  status: z.string().optional(),
  code: z.string().optional(),
  when: z.string().optional(),
  onError: z.boolean().optional(),
  why: S({ text: z.string().min(1), proof }).optional(),
});

const entrypoint = S({
  id: z.string().min(1),
  kind: z.enum(["http", "rpc", "event", "schedule", "message", "main", "cli"]),
  key: z.string().min(1),
  handler: symbolRef.optional(),
  proof,
  access: guard.optional(),
  calledBy: z.array(z.string()).optional(),
  files: z.array(z.string()).optional(),
  ranges: z.array(z.tuple([z.number().int(), z.number().int()])).optional(),
  flow: z.array(flowStep).optional(),
});

const field = S({
  name: z.string().min(1),
  type: z.string().optional(),
  nullable: z.boolean().optional(),
  values: z.array(z.string()).optional(),
  default: z.string().optional(),
  writes: z.array(S({
    value: z.string().optional(), fn: z.string().optional(), node: z.string().optional(), entrypoints: z.array(z.string()).optional(), proof,
  })).optional(),
  reads: z.array(S({
    whole: z.boolean().optional(), fn: z.string().optional(), node: z.string().optional(), entrypoints: z.array(z.string()).optional(), proof,
  })).optional(),
  proof: proof.optional(),
});

const constraint = S({
  kind: z.enum(["primary", "unique", "foreign", "check", "index"]),
  name: z.string().optional(),
  fields: z.array(z.string()),
  where: z.string().optional(),
  references: z.string().optional(),
  proof,
});

const entity = S({
  name: z.string().min(1),
  group: z.string().optional(),
  fields: z.array(field).optional(),
  constraints: z.array(constraint).optional(),
  rule: proof.optional(),
  triggers: z.array(S({ name: z.string(), on: z.array(z.enum(["insert", "update", "delete", "write"])), proof, writes: z.array(z.string()).optional() })).optional(),
  proof: proof.optional(),
});

const shape = S({
  name: z.string().min(1),
  proof,
  fields: z.array(S({ name: z.string().min(1), type: z.string().optional(), optional: z.boolean().optional(), comment: z.string().optional(), line: z.number().int().positive() })),
});

const setting = S({ key: z.string().min(1), value: z.string(), proof });

const facets = S({
  entrypoints: z.array(entrypoint).optional(),
  data: S({ shape: z.enum(["relational", "document", "key-value", "blob", "search", "graph", "unknown"]), entities: z.array(entity) }).optional(),
  contract: z.array(S({
    name: z.string().min(1),
    interface: symbolRef,
    summary: S({ text: z.string().min(1), proof }).optional(),
    operations: z.array(S({ name: z.string(), line: z.number().int(), comment: z.string().optional(), request: shape.optional(), result: shape.optional() })),
    implementations: z.array(S({
      name: z.string(), path: z.string(), line: z.number().int(),
      calls: z.array(S({ name: z.string().min(1), proof })).optional(),
      returns: z.array(proof).optional(),
      packages: z.array(z.string()).optional(),
    })),
    selector: S({
      symbol: symbolRef,
      config: z.array(z.string()).optional(),
      choices: z.array(S({ when: z.string().optional(), implementation: z.string().min(1), proof })).optional(),
    }).optional(),
    sealed: S({ packages: z.array(z.string()), leaks: z.array(proof) }).optional(),
  })).optional(),
  channel: S({
    shape: z.enum(["queue", "topic", "stream", "task", "event"]),
    topics: z.array(S({ name: z.string().min(1), proof, settings: z.array(setting).optional() })),
  }).optional(),
  config: S({
    env: z.array(S({ name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), readAt: z.array(proof), required: z.boolean().optional() })),
    environments: z.array(z.string()).optional(),
    loadChecks: z.array(S({ proof, required: z.array(z.string()), loadedBy: z.array(z.string()) })).optional(),
  }).optional(),
  trust: S({
    mechanisms: z.array(S({ name: z.string().min(1), proof })),
    exposure: z.enum(["public", "internal"]).optional(),
  }).optional(),
  functions: z.array(S({
    id: z.string().min(1),
    name: z.string().min(1),
    proof,
    end: z.number().int().positive(),
    exported: z.boolean().optional(),
    flow: z.array(flowStep).optional(),
    calledFrom: z.array(S({ proof, fn: z.string().optional() })).optional(),
    calls: z.array(S({ name: z.string().min(1), local: z.boolean(), proof, to: z.string().optional() })).optional(),
  })).optional(),
  component: S({
    grouping: z.enum(["folder", "calls", "contract"]),
    reach: z.enum(["own", "shared", "base"]),
    entrypoints: z.array(z.string()),
    functions: z.number().int().nonnegative(),
    touches: z.array(S({
      kind: edgeKind,
      node: z.string().min(1),
      entity: z.string().optional(),
      topic: z.string().optional(),
      count: z.number().int().positive(),
      proof: z.array(proof),
    })),
    layers: z.record(z.string(), z.enum(["entry", "logic", "data", "external"])).optional(),
  }).optional(),
});

const node = S({
  id: z.string().min(1),
  name: z.string().min(1),
  level,
  role: z.enum(["actor", "external", "app", "service", "function", "worker", "job", "store", "channel", "binary", "managed", "module", "layer", "adapter"]),
  parent: z.string().optional(),
  tech: z.array(z.string()).optional(),
  subtitle: z.string().optional(),
  status: z.enum(["extracted", "proposed", "declared"]),
  proof: z.array(proof),
  files: z.array(z.string()).optional(),
  instances: S({ min: z.number().int().nonnegative(), max: z.number().int().optional(), proof }).optional(),
  attributes: z.array(setting).optional(),
  facets,
});

const occurrence = proof.extend({ entrypoints: z.array(z.string()).optional() });

const edge = S({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  kind: edgeKind,
  target: S({ entity: z.string().optional(), entrypoint: z.string().optional(), topic: z.string().optional() }).optional(),
  count: z.number().int().nonnegative(),
  occurrences: z.array(occurrence),
});

const finding = S({
  code: z.enum([
    "uncalled_entry", "unknown_callable", "unresolved_target", "dynamic_path",
    "unguarded_route", "race_read_then_write", "write_then_enqueue", "order_assumption",
    "personal_data_logged", "scheduled_on_every_instance", "doc_contradiction",
    "unused_value", "dead_code", "missing_timeout",
  ]),
  message: z.string().min(1),
  proof: z.array(proof),
  nodes: z.array(z.string()).optional(),
  source,
});

const coverage = S({
  level,
  unit: z.enum(["files", "manifests", "deployables", "calls"]),
  read: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  understood: z.number().int().nonnegative().optional(),
  gaps: z.array(S({
    kind: z.enum(["language_not_read", "pack_missing", "pack_failed", "target_unknown", "path_dynamic", "manifest_unknown"]),
    subject: z.string().min(1),
    count: z.number().int().nonnegative(),
    proof: proof.optional(),
    where: z.array(proof).optional(),
  })),
});

export const archModelV2 = S({
  version: z.literal(2),
  system: S({ name: z.string().min(1) }),
  nodes: z.array(node),
  edges: z.array(edge),
  findings: z.array(finding),
  coverage: z.array(coverage),
});

/**
 * Valide un modèle v2, puis les références internes : parent, extrémités
 * des liens, nœuds cités par un constat. Renvoie la liste des problèmes,
 * vide si le modèle est sain.
 */
export function checkArchModelV2(input: unknown): string[] {
  const parsed = archModelV2.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`);
  const m = parsed.data;
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const n of m.nodes) {
    if (ids.has(n.id)) problems.push(`nœud en double : ${n.id}`);
    ids.add(n.id);
  }
  const entries = new Set(m.nodes.flatMap((n) => n.facets.entrypoints ?? []).map((e) => e.id));
  for (const n of m.nodes) {
    if (n.parent && !ids.has(n.parent)) problems.push(`${n.id} : parent inconnu ${n.parent}`);
    for (const id of n.facets.component?.entrypoints ?? []) if (!entries.has(id)) problems.push(`${n.id} : point d'entrée servi inconnu ${id}`);
    for (const t of n.facets.component?.touches ?? []) if (!ids.has(t.node)) problems.push(`${n.id} : cible touchée inconnue ${t.node}`);
    for (const e of n.facets.entrypoints ?? []) {
      for (const c of e.calledBy ?? []) if (!ids.has(c) && !entries.has(c)) problems.push(`${e.id} : appelant inconnu ${c}`);
    }
  }
  for (const e of m.edges) {
    if (!ids.has(e.from)) problems.push(`${e.id} : origine inconnue ${e.from}`);
    if (!ids.has(e.to)) problems.push(`${e.id} : cible inconnue ${e.to}`);
    if (e.target?.entrypoint && !entries.has(e.target.entrypoint)) problems.push(`${e.id} : point d'entrée inconnu ${e.target.entrypoint}`);
  }
  for (const f of m.findings) for (const id of f.nodes ?? []) if (!ids.has(id)) problems.push(`constat ${f.code} : nœud inconnu ${id}`);
  return problems;
}

// Le schéma et le type restent identiques, dans les deux sens.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const sameShape: Same<z.infer<typeof archModelV2>, ArchModelV2> = true;
void sameShape;
