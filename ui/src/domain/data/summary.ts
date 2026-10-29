import type { ArchModelV2, Entrypoint, Occurrence } from "../../api/types";
import { joinWords } from "../text/plural";
import type { Access, Actor } from "./actors";

/** Une ligne de `Lue par · écrite par` : un verbe, un acteur, une preuve par fichier. */
export interface AccessRow {
  verb: "read" | "write";
  actor: Actor;
  files: Occurrence[];
}

/** Les lecteurs puis les écrivains d'une entité, une seule preuve par fichier. */
export function accessRows(actors: Actor[], access: Map<string, Access>): AccessRow[] {
  return (["read", "write"] as const).flatMap((verb) => actors.flatMap((actor) => {
    const occ = access.get(actor.id)?.[verb] ?? [];
    const files = [...new Map(occ.map((o) => [o.path, o])).values()];
    return files.length ? [{ verb, actor, files }] : [];
  }));
}

/** Ce que le code montre de qui écrit : `Seul api écrit ici.` */
export function writersSentence(labels: string[]): string {
  if (!labels.length) return "Aucune écriture lue dans le code.";
  return labels.length === 1 ? `Seul ${labels[0]} écrit ici.` : `${joinWords(labels)} écrivent ici.`;
}

/** Les points d'entrée dont le code écrit l'entité : `createPayment`, `stripeWebhook`. */
export function modifyingEntries(access: Map<string, Access>, model: ArchModelV2): Entrypoint[] {
  const all = new Map(model.nodes.flatMap((n) => (n.facets.entrypoints ?? []).map((e) => [e.id, e] as const)));
  const ids = new Set([...access.values()].flatMap((a) => a.write.flatMap((o) => o.entrypoints ?? [])));
  return [...ids].map((id) => all.get(id)).filter((e): e is Entrypoint => !!e)
    .sort((a, b) => (a.handler?.name ?? a.key).localeCompare(b.handler?.name ?? b.key));
}
