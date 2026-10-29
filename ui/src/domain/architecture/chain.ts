import type { EdgeKind } from "../../api/types";
import type { MapLink } from "./links";

/** Les natures qui font avancer un trajet : un appel, une mise en file, un déclenchement. Lire une table n'avance pas. */
const FLOW: EdgeKind[] = ["call", "request", "message", "trigger"];

export interface ChainStep {
  to: string;
  kind: EdgeKind;
}

/**
 * Le plus long trajet sans boucle, depuis ce que les gens ouvrent (ou depuis
 * tout bloc que rien n'appelle) : `web → api → redis → worker → resend`.
 */
export function longestChain(links: MapLink[], starts: string[]): { from: string; steps: ChainStep[] } | undefined {
  const out = new Map<string, ChainStep[]>();
  for (const l of links) {
    const kind = FLOW.find((k) => l.kinds[k]);
    if (kind) (out.get(l.from) ?? out.set(l.from, []).get(l.from)!).push({ to: l.to, kind });
  }
  const targets = new Set([...out.values()].flat().map((s) => s.to));
  const roots = starts.length ? starts : [...out.keys()].filter((id) => !targets.has(id));
  let best: { from: string; steps: ChainStep[] } | undefined;
  const walk = (from: string, at: string, steps: ChainStep[], seen: Set<string>) => {
    if (!best || steps.length > best.steps.length) best = { from, steps: [...steps] };
    for (const s of (out.get(at) ?? []).sort((a, b) => a.to.localeCompare(b.to))) {
      if (seen.has(s.to)) continue;
      seen.add(s.to);
      walk(from, s.to, [...steps, s], seen);
      seen.delete(s.to);
    }
  };
  for (const r of roots.sort()) walk(r, r, [], new Set([r]));
  return best && best.steps.length > 0 ? best : undefined;
}
