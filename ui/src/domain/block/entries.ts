import type { ArchModelV2, ArchNode, Entrypoint } from "../../api/types";
import { cronLabel } from "../text/cron";

/** La nature d'un point d'entrée, dite comme dans les maquettes. */
export function entryNature(e: Entrypoint): string {
  if (e.kind === "http") return e.access?.level === "signature" ? "webhook" : "route";
  const NATURE: Record<Entrypoint["kind"], string> = {
    http: "route", rpc: "fonction", event: "événement", schedule: "planifiée", message: "file", main: "démarrage", cli: "commande",
  };
  return NATURE[e.kind];
}

/** Les points d'entrée qu'une personne ou un autre programme déclenche : le démarrage du processus est à part. */
export function blockEntries(node: ArchNode): Entrypoint[] {
  return (node.facets.entrypoints ?? []).filter((e) => e.kind !== "main");
}

/** Un point d'entrée qu'aucun code du dépôt n'appelle, d'après le constat `uncalled_entry`. */
export function isUncalled(e: Entrypoint, model: ArchModelV2): boolean {
  return model.findings.some((f) => f.code === "uncalled_entry" && f.proof.some((p) => p.path === e.proof.path && p.line === e.proof.line));
}

/** Qui déclenche ce point d'entrée : l'horaire, les blocs qui l'appellent ou lui envoient un message, ou rien de lu. */
export function triggeredBy(e: Entrypoint, names: Map<string, string>, model: ArchModelV2): string[] {
  if (e.kind === "schedule") return [cronLabel(e.key)];
  const senders = model.edges.filter((x) => x.target?.entrypoint === e.id).map((x) => x.from);
  return [...new Set([...(e.calledBy ?? []), ...senders])].map((id) => names.get(id) ?? id);
}

/** Les compteurs du bandeau : `14 routes`, `1 webhook`, `3 planifiées`, puis ceux jamais appelés. */
export function entryCounters(node: ArchNode, model: ArchModelV2): { value: number; label: string; attention?: boolean }[] {
  const entries = blockEntries(node);
  const byNature = new Map<string, number>();
  for (const e of entries) byNature.set(entryNature(e), (byNature.get(entryNature(e)) ?? 0) + 1);
  const WORDS: Record<string, [string, string]> = {
    route: ["route", "routes"], webhook: ["webhook", "webhooks"], planifiée: ["tâche planifiée", "tâches planifiées"],
    file: ["file écoutée", "files écoutées"], fonction: ["fonction appelable", "fonctions appelables"],
    événement: ["événement reçu", "événements reçus"], commande: ["commande", "commandes"],
  };
  const counters: { value: number; label: string; attention?: boolean }[] = [...byNature.entries()].map(([nature, n]) => {
    const [one, many] = WORDS[nature] ?? [nature, nature];
    return { value: n, label: n > 1 ? many : one };
  });
  const uncalled = entries.filter((e) => isUncalled(e, model)).length;
  if (uncalled) counters.push({ value: uncalled, label: uncalled > 1 ? "jamais appelés" : "jamais appelé", attention: true });
  return counters;
}
