import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ArchModel } from "../arch/types.js";
import type { ActivityEvent, AgentKind, TokenUsage } from "./journal.js";
import { readUsage } from "./usage.js";

/**
 * Coût en tokens des features (ADR 0013). Attribution déterministe :
 * une session d'agent est répartie à parts égales entre les fichiers qu'elle
 * a modifiés ; la part d'un fichier va, à parts égales, aux features qui
 * l'exécutent (sinon au bloc qui le contient, sinon « hors carte »).
 * Une session qui n'a rien modifié (exploration, questions) reste visible à
 * part, jamais imputée à une feature.
 */

type Counters = Omit<TokenUsage, "model" | "byModel">;

export interface SessionCost {
  agent: AgentKind;
  session: string;
  start: string;
  end: string;
  model?: string;
  usage?: TokenUsage;
  /** Tokens facturés : entrée + cache (lu et écrit) + sortie. */
  tokens: number;
  cost?: number;
  files: string[];
  /** Nombre de lectures de la carte (outils vision_*) : l'agent a-t-il lu le système avant d'écrire ? */
  mapReads: number;
  mapReadBeforeFirstEdit: boolean;
}

export interface Share {
  agent: AgentKind;
  session: string;
  /** Fraction de la session imputée à cette cible. */
  fraction: number;
  tokens: number;
  cost?: number;
  files: string[];
}

export interface CostTarget {
  kind: "feature" | "block" | "outside";
  id: string;
  name: string;
  block?: string;
  tokens: number;
  cost?: number;
  shares: Share[];
}

export interface CostReport {
  currency?: string;
  priced: boolean;
  sessions: SessionCost[];
  targets: CostTarget[];
  /** Sessions sans aucune modification de fichier : coût réel, mais d'aucune feature. */
  unattributed: SessionCost[];
}

export interface Prices {
  currency: string;
  /** Prix par million de tokens, par modèle ; la clé peut être un préfixe (« claude-opus »). */
  perMillion: Record<string, { input: number; output: number; cacheRead?: number; cacheWrite?: number }>;
}

/** `.vision/prices.json` — déclaré par un humain : VisionLayer n'invente aucun tarif. */
export function readPrices(root: string): Prices | undefined {
  const path = join(root, ".vision", "prices.json");
  if (!existsSync(path)) return undefined;
  const p = JSON.parse(readFileSync(path, "utf-8")) as Prices;
  return p && p.perMillion ? p : undefined;
}

function priceOf(prices: Prices, model: string) {
  if (prices.perMillion[model]) return prices.perMillion[model];
  const key = Object.keys(prices.perMillion)
    .filter((k) => model.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return key ? prices.perMillion[key] : undefined;
}

export function costOf(usage: TokenUsage, prices: Prices | undefined): number | undefined {
  if (!prices) return undefined;
  let total = 0;
  for (const [model, c] of Object.entries(usage.byModel)) {
    const p = priceOf(prices, model);
    if (!p) return undefined; // un modèle sans tarif déclaré : pas de montant plutôt qu'un montant faux
    total += (c.input * p.input + c.output * p.output + c.cacheRead * (p.cacheRead ?? p.input) + c.cacheWrite * (p.cacheWrite ?? p.input)) / 1e6;
  }
  return total;
}

const billed = (c: Counters) => c.input + c.cacheRead + c.cacheWrite + c.output;

export function buildCostReport(arch: ArchModel, events: ActivityEvent[], prices?: Prices): CostReport {
  const bySession = new Map<string, ActivityEvent[]>();
  for (const e of events) {
    const k = `${e.agent}:${e.session}`;
    bySession.set(k, [...(bySession.get(k) ?? []), e]);
  }

  const sessions: SessionCost[] = [];
  for (const evs of bySession.values()) {
    evs.sort((a, b) => a.at.localeCompare(b.at));
    const first = evs[0]!;
    const files = [...new Set(evs.flatMap((e) => e.files ?? []))].sort();
    // Les compteurs les plus récents consignés ; sinon, le transcript s'il est encore là.
    let usage = [...evs].reverse().find((e) => e.usage)?.usage;
    const transcript = [...evs].reverse().find((e) => e.transcript)?.transcript;
    if (!usage && transcript) usage = readUsage(first.agent, transcript);
    const firstEdit = evs.find((e) => e.files?.length)?.at;
    const mapReads = evs.filter((e) => e.tool && /vision_/.test(e.tool));
    sessions.push({
      agent: first.agent,
      session: first.session,
      start: first.at,
      end: evs[evs.length - 1]!.at,
      model: usage?.model ?? evs.find((e) => e.model)?.model,
      usage,
      tokens: usage ? billed(usage) : 0,
      cost: usage ? costOf(usage, prices) : undefined,
      files,
      mapReads: mapReads.length,
      mapReadBeforeFirstEdit: !!firstEdit && mapReads.some((e) => e.at <= firstEdit),
    });
  }

  const features = arch.entries.filter((e) => e.files?.length);
  const targets = new Map<string, CostTarget>();
  const target = (kind: CostTarget["kind"], id: string, name: string, block?: string): CostTarget => {
    const k = `${kind}:${id}`;
    let t = targets.get(k);
    if (!t) targets.set(k, (t = { kind, id, name, block, tokens: 0, cost: prices ? 0 : undefined, shares: [] }));
    return t;
  };

  const unattributed: SessionCost[] = [];
  for (const s of sessions) {
    if (!s.files.length) {
      unattributed.push(s);
      continue;
    }
    const perFile = 1 / s.files.length;
    const parts = new Map<CostTarget, { fraction: number; files: string[] }>();
    for (const f of s.files) {
      const owners = features.filter((e) => e.files!.includes(f));
      let ts: CostTarget[];
      if (owners.length) ts = owners.map((e) => target("feature", e.id, e.name, e.block));
      else {
        const blocks = arch.blocks.filter((b) => b.files.includes(f));
        ts = blocks.length ? blocks.map((b) => target("block", b.id, b.name, b.id)) : [target("outside", "hors-carte", "hors carte")];
      }
      for (const t of ts) {
        const p = parts.get(t) ?? { fraction: 0, files: [] };
        p.fraction += perFile / ts.length;
        p.files.push(f);
        parts.set(t, p);
      }
    }
    for (const [t, p] of parts) {
      const tokens = s.tokens * p.fraction;
      const cost = s.cost !== undefined ? s.cost * p.fraction : undefined;
      t.tokens += tokens;
      if (t.cost !== undefined) t.cost = cost === undefined ? undefined : t.cost + cost;
      t.shares.push({ agent: s.agent, session: s.session, fraction: p.fraction, tokens, cost, files: p.files });
    }
  }

  return {
    currency: prices?.currency,
    priced: !!prices,
    sessions: sessions.sort((a, b) => b.end.localeCompare(a.end)),
    targets: [...targets.values()].sort((a, b) => b.tokens - a.tokens),
    unattributed,
  };
}
