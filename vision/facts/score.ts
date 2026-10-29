import type { ArchModelV2, ArchNode, Proof } from "../arch/types.js";

/**
 * Compare une carte produite à l'oracle d'un projet du corpus, écrit à la
 * main (`expected.arch.json`). Ce n'est pas un bench : c'est le contrôle de
 * la construction, et sur le corpus de contrôle, la mesure (RYP-224).
 *
 * Les nœuds sont appariés par ce qu'ils contiennent, jamais par leur nom :
 * un déployable par ses points d'entrée ou ses preuves, un stockage ou un
 * service externe par sa technologie.
 *
 * Un nœud calculé par une règle (`status: "proposed"`) n'est pas compté :
 * l'oracle ne contient que des faits.
 *
 * Quatre mesures par ligne :
 * - trouvé : dans l'oracle et dans la carte ;
 * - en plus : dans la carte, pas dans l'oracle. À relire à la main : c'est un faux, ou un oubli de l'oracle ;
 * - non lu : manquant, et la couverture le dit (un fichier qui prouve l'élément dans l'oracle est désigné par un trou) ;
 * - manqué : manquant sans que rien ne le dise. C'est le pire cas : la carte a l'air complète.
 */

export interface ScoreLine {
  what: string;
  expected: number;
  found: number;
  missing: string[];
  /** Parmi `missing`, ce que la couverture déclare non lu. */
  unread: string[];
  /** Montré par la carte sans exister dans l'oracle. */
  extra: string[];
}

interface Item { label: string; ok: boolean; files: string[] }

export function score(all: ArchModelV2, oracle: ArchModelV2): ScoreLine[] {
  // Un nœud calculé par une règle (`proposed`, un composant regroupé par ses appels) n'est pas un fait de l'oracle :
  // ni lui ni ses liens ne sont comptés.
  const proposed = new Set(all.nodes.filter((n) => n.status === "proposed").map((n) => n.id));
  const found: ArchModelV2 = { ...all, nodes: all.nodes.filter((n) => !proposed.has(n.id)), edges: all.edges.filter((e) => !proposed.has(e.from) && !proposed.has(e.to)) };
  // Un à un : un nœud trouvé ne compte que pour un nœud de l'oracle, le plus proche (points d'entrée et fichiers en commun).
  const pair = new Map<string, ArchNode>();
  const candidates = oracle.nodes.flatMap((o) => found.nodes.filter((f) => sameNode(o, f)).map((f) => ({ o, f, w: closeness(o, f) })));
  const paired = new Set<string>();
  for (const { o, f } of candidates.sort((a, b) => b.w - a.w)) {
    if (pair.has(o.id) || paired.has(f.id)) continue;
    pair.set(o.id, f);
    paired.add(f.id);
  }
  const unreadFiles = new Set(found.coverage.flatMap((c) => c.gaps.flatMap((g) => [...(g.where ?? []), ...(g.proof ? [g.proof] : [])].map((p) => p.path))));
  const paths = (ps: (Proof | undefined)[]) => [...new Set(ps.filter((p): p is Proof => !!p).map((p) => p.path))];

  const lines: ScoreLine[] = [];
  const line = (what: string, items: Item[], extra: string[] = []) => {
    const missing = items.filter((i) => !i.ok);
    lines.push({
      what,
      expected: items.length,
      found: items.length - missing.length,
      missing: missing.map((i) => i.label),
      unread: missing.filter((i) => i.files.some((f) => unreadFiles.has(f))).map((i) => i.label),
      extra,
    });
  };

  line("nœuds", oracle.nodes.map((o) => ({ label: `${o.id} (${o.level}/${o.role})`, ok: pair.has(o.id), files: paths(o.proof) })),
    found.nodes.filter((f) => !paired.has(f.id)).map((f) => `${f.id} (${f.level}/${f.role})`));

  /** Ce que l'oracle attend dans le nœud trouvé `f`, sous forme de clés. */
  const oracleOf = (f: ArchNode) => oracle.nodes.filter((o) => pair.get(o.id)?.id === f.id);
  const entries = oracle.nodes.flatMap((o) => (o.facets.entrypoints ?? []).map((e) => ({ o, e })));
  const foundEntry = (o: ArchNode, kind: string, key: string) => pair.get(o.id)?.facets.entrypoints?.find((x) => x.kind === kind && x.key === key);
  line("points d'entrée", entries.map(({ o, e }) => ({ label: `${o.id} ${e.kind} ${e.key}`, ok: !!foundEntry(o, e.kind, e.key), files: paths([e.proof, e.handler && { ...e.handler, source: "syntax" }]) })),
    found.nodes.flatMap((f) => (f.facets.entrypoints ?? [])
      .filter((x) => !oracleOf(f).some((o) => o.facets.entrypoints?.some((e) => e.kind === x.kind && e.key === x.key)))
      .map((x) => `${f.id} ${x.kind} ${x.key}`)));
  line("code des points d'entrée", entries.filter(({ e }) => e.handler).map(({ o, e }) => {
    const x = foundEntry(o, e.kind, e.key);
    return { label: `${e.key} → ${e.handler!.path}:${e.handler!.line}`, ok: !!x?.handler && x.handler.path === e.handler!.path && x.handler.line === e.handler!.line, files: [e.handler!.path] };
  }));

  line("entités", oracle.nodes.flatMap((o) => (o.facets.data?.entities ?? []).map((ent) => ({
    label: `${o.id}.${ent.name}`,
    ok: !!pair.get(o.id)?.facets.data?.entities.some((x) => x.name === ent.name),
    files: paths([ent.proof]),
  }))), found.nodes.flatMap((f) => (f.facets.data?.entities ?? [])
    .filter((x) => !oracleOf(f).some((o) => o.facets.data?.entities.some((e) => e.name === x.name)))
    .map((x) => `${f.id}.${x.name}`)));
  line("canaux", oracle.nodes.flatMap((o) => (o.facets.channel?.topics ?? []).map((t) => ({
    label: `${o.id} ${t.name}`,
    ok: !!pair.get(o.id)?.facets.channel?.topics.some((x) => x.name === t.name),
    files: paths([t.proof]),
  }))), found.nodes.flatMap((f) => (f.facets.channel?.topics ?? [])
    .filter((x) => !oracleOf(f).some((o) => o.facets.channel?.topics.some((t) => t.name === x.name)))
    .map((x) => `${f.id} ${x.name}`)));
  const oracleContracts = new Set(oracle.nodes.flatMap((o) => (o.facets.contract ?? []).map((c) => c.name)));
  line("contrats", oracle.nodes.flatMap((o) => (o.facets.contract ?? []).map((c) => ({
    label: `${o.id} ${c.name}`,
    ok: found.nodes.some((f) => f.facets.contract?.some((x) => x.name === c.name)),
    files: [c.interface.path],
  }))), [...new Set(found.nodes.flatMap((f) => (f.facets.contract ?? []).map((c) => c.name)))].filter((n) => !oracleContracts.has(n)));
  line("instances", oracle.nodes.filter((o) => o.instances).map((o) => ({ label: `${o.id} ×${o.instances!.min}`, ok: pair.get(o.id)?.instances?.min === o.instances!.min, files: paths([o.instances!.proof]) })));

  const env = new Set(found.nodes.flatMap((n) => n.facets.config?.env.map((e) => e.name) ?? []));
  const oracleEnv = new Map<string, string[]>();
  for (const n of oracle.nodes) for (const e of n.facets.config?.env ?? []) oracleEnv.set(e.name, [...(oracleEnv.get(e.name) ?? []), ...paths(e.readAt)]);
  line("variables d'environnement (noms)", [...oracleEnv].sort(([a], [b]) => a.localeCompare(b)).map(([name, files]) => ({ label: name, ok: env.has(name), files })),
    [...env].filter((n) => !oracleEnv.has(n)).sort());

  // Liens : mêmes extrémités appariées, même genre, même cible fine (entité, topic, point d'entrée par sa clé).
  const keyOf = (model: ArchModelV2, entrypointId?: string) => {
    if (!entrypointId) return "";
    for (const n of model.nodes) for (const e of n.facets.entrypoints ?? []) if (e.id === entrypointId) return `${e.kind} ${e.key}`;
    return entrypointId;
  };
  const targetOf = (model: ArchModelV2, e: ArchModelV2["edges"][number]) => e.target?.entity ?? e.target?.topic ?? keyOf(model, e.target?.entrypoint);
  const matched = new Set<string>();
  line("liens", oracle.edges.map((e) => {
    const from = pair.get(e.from), to = pair.get(e.to);
    const target = targetOf(oracle, e);
    const hits = !from || !to ? [] : found.edges.filter((x) => x.from === from.id && x.to === to.id && x.kind === e.kind && targetOf(found, x) === target);
    for (const h of hits) matched.add(h.id);
    return { label: `${e.from} ${e.kind} ${e.to}${target ? ` (${target})` : ""}`, ok: hits.length > 0, files: paths(e.occurrences) };
  }), found.edges.filter((x) => !matched.has(x.id)).map((x) => { const t = targetOf(found, x); return `${x.from} ${x.kind} ${x.to}${t ? ` (${t})` : ""}`; }));

  const sameFinding = (a: ArchModelV2["findings"][number], b: ArchModelV2["findings"][number]) =>
    a.code === b.code && a.proof.some((p) => b.proof.some((q) => q.path === p.path && q.line === p.line));
  line("constats", oracle.findings.map((f) => ({
    label: `${f.code} ${f.proof[0] ? `${f.proof[0].path}:${f.proof[0].line}` : ""}`,
    ok: found.findings.some((x) => sameFinding(x, f)),
    files: paths(f.proof),
  })), found.findings.filter((x) => !oracle.findings.some((f) => sameFinding(x, f))).map((x) => `${x.code} ${x.proof[0] ? `${x.proof[0].path}:${x.proof[0].line}` : ""}`));
  return lines;
}

function closeness(o: ArchNode, f: ArchNode): number {
  const keys = (n: ArchNode) => new Set((n.facets.entrypoints ?? []).map((e) => `${e.kind} ${e.key}`));
  const fk = keys(f);
  const files = new Set(f.proof.map((p) => p.path));
  return [...keys(o)].filter((k) => fk.has(k)).length * 10 + o.proof.filter((p) => files.has(p.path)).length;
}

function sameNode(o: ArchNode, f: ArchNode): boolean {
  if (o.level !== f.level) return false;
  const contracts = (n: ArchNode) => (n.facets.contract ?? []).map((c) => c.name);
  if (contracts(o).length) return contracts(o).some((c) => contracts(f).includes(c));
  const keys = (n: ArchNode) => new Set((n.facets.entrypoints ?? []).filter((e) => e.kind !== "main").map((e) => `${e.kind} ${e.key}`));
  const ok = keys(o), fk = keys(f);
  if (ok.size && [...ok].some((k) => fk.has(k))) return true;
  if (o.role === "app" || f.role === "app") return o.role === f.role && o.proof.some((p) => f.proof.some((q) => q.path === p.path));
  if (o.level === "deployable" && ok.size) return false;
  return !!o.tech?.length && !!f.tech?.some((t) => o.tech!.includes(t)) && (o.level !== "deployable" || ["store", "channel", "managed"].includes(f.role));
}

export function formatScore(lines: ScoreLine[]): string {
  const w = Math.max(...lines.map((l) => l.what.length));
  const list = (xs: string[]) => `${xs.slice(0, 6).join(" ; ")}${xs.length > 6 ? ` (et ${xs.length - 6} autres)` : ""}`;
  const rows = lines.map((l) => {
    const silent = l.missing.filter((m) => !l.unread.includes(m));
    const head = `${l.what.padEnd(w)}  trouvé ${String(l.found).padStart(3)} / ${String(l.expected).padEnd(3)}  en plus ${String(l.extra.length).padStart(3)}  non lu ${String(l.unread.length).padStart(3)}  manqué ${String(silent.length).padStart(3)}`;
    return [head,
      ...(silent.length ? [`    manqué : ${list(silent)}`] : []),
      ...(l.unread.length ? [`    non lu : ${list(l.unread)}`] : []),
      ...(l.extra.length ? [`    en plus, à relire : ${list(l.extra)}`] : []),
    ].join("\n");
  });
  const t = (f: (l: ScoreLine) => number) => lines.reduce((a, l) => a + f(l), 0);
  return [...rows, "",
    `Total  trouvé ${t((l) => l.found)} / ${t((l) => l.expected)}, en plus ${t((l) => l.extra.length)} (faux ou oublis de l'oracle, à relire), non lu ${t((l) => l.unread.length)}, manqué sans le dire ${t((l) => l.missing.length - l.unread.length)}`,
  ].join("\n");
}
