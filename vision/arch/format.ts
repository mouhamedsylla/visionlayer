import type { ArchModel, ArchBlock, LinkKind } from "./types.js";
import type { Flow, FlowStep } from "./flow.js";

export const BLOCK_KIND_LABEL: Record<ArchBlock["kind"], string> = {
  client: "application cliente",
  service: "service",
  datastore: "stockage de données",
  queue: "file / événements",
  capability: "capacité",
  external: "système externe",
};

export const LINK_KIND_LABEL: Record<LinkKind, string> = {
  calls: "appelle",
  reads: "lit",
  writes: "écrit",
  triggers: "déclenche",
  enqueues: "met en file",
  uses: "utilise",
  requests: "requête HTTP",
};

/** Sortie texte de `vision archi` — même contenu que le niveau Architecture. */
export function formatArchModel(arch: ArchModel): string {
  const out: string[] = ["ARCHITECTURE — ce qui s'exécute et qui parle à qui", "────────────────────────────────", ""];
  const name = (id: string) => arch.blocks.find((b) => b.id === id)?.name ?? id;
  out.push(`BLOCS (${arch.blocks.length})`);
  for (const b of arch.blocks) {
    out.push(`  ${b.name}  [${BLOCK_KIND_LABEL[b.kind]}]  ${b.subtitle}  ← ${b.origin.path}:${b.origin.line}`);
    const entries = arch.entries.filter((e) => e.block === b.id);
    if (entries.length) out.push(`      entrées : ${entries.map((e) => `${e.name} (${e.kind}${e.detail ? ` · ${e.detail}` : ""})`).join(", ")}`);
    if (b.interior?.kind === "ai") {
      out.push(`      fournisseurs : ${b.interior.providers.map((p) => p.name).join(", ")}`);
      out.push(`      modèles cités : ${b.interior.models.map((m) => m.name).join(", ")}`);
    }
    if (b.interior?.kind === "queue") for (const t of b.interior.targets) out.push(`      cible : ${t.label}  ← ${t.evidence.path}:${t.evidence.line}`);
  }
  out.push("");
  out.push(`LIENS (${arch.links.length})`);
  for (const l of arch.links) out.push(`  ${name(l.from)} —${LINK_KIND_LABEL[l.kind]} ×${l.count}→ ${name(l.to)}${l.targets.length ? `  [${l.targets.map((t) => arch.entries.find((e) => e.id === t)?.name ?? t).join(", ")}]` : ""}`);
  const fs = arch.blocks.find((b) => b.interior?.kind === "datastore");
  if (fs?.interior?.kind === "datastore") {
    out.push("");
    out.push(`COLLECTIONS (${fs.interior.collections.length})`);
    for (const c of fs.interior.collections) {
      const who = (xs: typeof c.reads) => [...new Set(xs.map((x) => name(x.block)))].join(", ") || "—";
      out.push(`  ${c.path}  lu par : ${who(c.reads)} · écrit par : ${who(c.writes)}${c.triggers.length ? ` · déclenche : ${c.triggers.map((t) => arch.entries.find((e) => e.id === t)?.name).join(", ")}` : ""}${c.rules ? `  (règles ${c.rules.path}:${c.rules.line})` : ""}`);
    }
  }
  if (arch.warnings.length) {
    out.push("");
    out.push(`POINTS D'ATTENTION (${arch.warnings.length})`);
    for (const w of arch.warnings) out.push(`  ⚠ ${w.message}${w.evidence ? `  ← ${w.evidence.path}:${w.evidence.line}` : ""}`);
  }
  return out.join("\n") + "\n";
}

/** Trouve un bloc par id ou par nom (insensible à la casse, correspondance exacte puis partielle). */
export function findBlock(arch: ArchModel, query: string): ArchBlock | undefined {
  const q = query.trim().toLowerCase();
  return arch.blocks.find((b) => b.id.toLowerCase() === q || b.name.toLowerCase() === q) ?? arch.blocks.find((b) => b.name.toLowerCase().includes(q));
}

/**
 * Un seul bloc et son voisinage : ses points d'entrée, ses liens entrants et
 * sortants, son intérieur. Pour un agent, c'est la carte d'un bloc sans le
 * reste du système — quelques centaines de tokens au lieu de la carte entière.
 */
export function formatBlock(arch: ArchModel, b: ArchBlock): string {
  const name = (id: string) => arch.blocks.find((x) => x.id === id)?.name ?? id;
  const entryName = (id: string) => arch.entries.find((e) => e.id === id)?.name ?? id;
  const out: string[] = [`BLOC — ${b.name}  [${BLOCK_KIND_LABEL[b.kind]}]  ${b.subtitle}  ← ${b.origin.path}:${b.origin.line}`];
  if (b.files.length) out.push(`  ${b.files.length} fichiers exécutés`);
  const entries = arch.entries.filter((e) => e.block === b.id);
  if (entries.length) {
    out.push("", `POINTS D'ENTRÉE (${entries.length})`);
    for (const e of entries) out.push(`  ${e.name} (${e.kind}${e.detail ? ` · ${e.detail}` : ""})  ← ${e.path}:${e.line}`);
  }
  const outgoing = arch.links.filter((l) => l.from === b.id);
  const incoming = arch.links.filter((l) => l.to === b.id);
  const linkLine = (l: ArchModel["links"][number], other: string) =>
    `  ${LINK_KIND_LABEL[l.kind]} ×${l.count} ${other}${l.targets.length ? `  [${l.targets.map(entryName).join(", ")}]` : ""}  ← ${l.evidence[0] ? `${l.evidence[0].path}:${l.evidence[0].line}` : ""}`;
  if (outgoing.length) {
    out.push("", `VERS (${outgoing.length})`);
    for (const l of outgoing) out.push(linkLine(l, name(l.to)));
  }
  if (incoming.length) {
    out.push("", `DEPUIS (${incoming.length})`);
    for (const l of incoming) out.push(linkLine(l, `depuis ${name(l.from)}`));
  }
  const i = b.interior;
  if (i?.kind === "ai") {
    out.push("", "INTÉRIEUR");
    out.push(`  fournisseurs : ${i.providers.map((p) => `${p.name} ← ${p.evidence[0]?.path}:${p.evidence[0]?.line}`).join(" · ")}`);
    out.push(`  modèles cités : ${i.models.map((m) => m.name).join(", ")}`);
    out.push(`  features qui l'atteignent : ${i.usedBy.map(entryName).join(", ")}`);
  } else if (i?.kind === "queue") {
    out.push("", "INTÉRIEUR");
    for (const t of i.targets) out.push(`  cible : ${t.label}  ← ${t.evidence.path}:${t.evidence.line}`);
  } else if (i?.kind === "datastore") {
    out.push("", `COLLECTIONS (${i.collections.length})`);
    for (const c of i.collections) {
      const who = (xs: typeof c.reads) => [...new Set(xs.map((x) => name(x.block)))].join(", ") || "—";
      out.push(`  ${c.path}  lu : ${who(c.reads)} · écrit : ${who(c.writes)}${c.triggers.length ? ` · déclenche : ${c.triggers.map(entryName).join(", ")}` : ""}${c.rules ? `  (règle :${c.rules.line})` : "  (aucune règle)"}`);
    }
  }
  // Collections que CE bloc touche (quand il n'est pas lui-même la base).
  const store = arch.blocks.find((x) => x.interior?.kind === "datastore");
  if (store && store.id !== b.id && store.interior?.kind === "datastore") {
    const touched = store.interior.collections
      .map((c) => ({ c, r: c.reads.some((a) => a.block === b.id), w: c.writes.some((a) => a.block === b.id) }))
      .filter((x) => x.r || x.w);
    if (touched.length) {
      out.push("", `COLLECTIONS TOUCHÉES (${touched.length})`);
      for (const { c, r, w } of touched) out.push(`  ${c.path}  ${[r && "lit", w && "écrit"].filter(Boolean).join(" · ")}`);
    }
  }
  const warnings = arch.warnings.filter((w) => w.evidence && b.files.includes(w.evidence.path));
  if (warnings.length) {
    out.push("", `POINTS D'ATTENTION (${warnings.length})`);
    for (const w of warnings) out.push(`  ⚠ ${w.message}  ← ${w.evidence!.path}:${w.evidence!.line}`);
  }
  return out.join("\n") + "\n";
}

/** Retire les appels sans effet (calculs purs) : ce qu'un relecteur ou un agent n'a pas besoin de lire. */
export function withoutPureCalls(steps: FlowStep[]): FlowStep[] {
  return steps
    .filter((s) => !(s.kind === "call" && !s.effects?.length && !s.children?.length))
    .map((s) => (s.children ? { ...s, children: withoutPureCalls(s.children) } : s));
}

/** Sortie texte de `vision archi --feature X` : l'algorithme d'une feature, étape par étape. */
export function formatFlow(flow: Flow, arch: ArchModel): string {
  const out: string[] = [];
  const e = flow.entry;
  out.push(`FEATURE — ${e ? `${e.name} (${e.kind}${e.detail ? ` · ${e.detail}` : ""})` : flow.symbol.name}`);
  out.push(`  ${flow.symbol.path}:${flow.symbol.line}-${flow.symbol.endLine}`);
  out.push("");
  if (flow.callers.length) {
    out.push("APPELÉE PAR");
    for (const c of flow.callers) out.push(`  ${arch.blocks.find((b) => b.id === c.block)?.name ?? c.block} · ${c.via ?? "?"}()  ← ${c.path}:${c.line}${c.usedBy.length ? `\n      utilisée par : ${c.usedBy.join(", ")}` : ""}`);
    out.push("");
  }
  out.push("ÉTAPES");
  const print = (steps: FlowStep[], depth: number) => {
    for (const s of steps) {
      const fx = s.effects?.length ? `  ⟶ ${s.effects.join(" · ")}` : "";
      out.push(`${"  ".repeat(depth + 1)}${MARK[s.kind]} ${s.label}${fx}  :${s.line}`);
      if (s.children) print(s.children, depth + 1);
    }
  };
  print(flow.steps, 0);
  if (flow.next.length) {
    out.push("");
    out.push("ENSUITE");
    for (const n of flow.next) out.push(`  → ${n.label}  ← ${n.path}:${n.line}`);
  }
  return out.join("\n") + "\n";
}

const MARK: Record<FlowStep["kind"], string> = {
  guard: "⛔",
  branch: "◇",
  loop: "↻",
  call: "·",
  read: "◀ ",
  write: "▶ ",
  ai: "✦",
  enqueue: "⇢",
  request: "⇢",
  storage: "▣",
  auth: "⚿",
  callable: "⇢",
  return: "↩",
  throw: "✖",
  callback: "⤷",
};
