import type { ArchModelV2, TechLabel } from "../../api/types";
import { mapLinks, mapNodes } from "../architecture/links";
import { dataStores, entityWord } from "../data/stores";
import { isBackground } from "../messages/triggers";
import { count } from "../text/plural";

/** Un compteur du bandeau : la valeur, ce qu'elle compte, et l'écran qui la détaille. */
export interface HeroStat {
  value: string;
  label: string;
  /** L'écran qui détaille ce compteur. */
  screen: string;
}

/** Les quatre compteurs de la Vue d'ensemble, tous comptés sur la carte. */
export function overviewStats(model: ArchModelV2, tech: Record<string, TechLabel>): HeroStat[] {
  const nodes = mapNodes(model);
  const links = mapLinks(model);
  const entries = model.nodes.flatMap((n) => n.facets.entrypoints ?? []).filter((e) => e.kind !== "main");
  const unprompted = entries.filter(isBackground).length;
  const stores = dataStores(model);
  const words = new Set(stores.map((s) => entityWord(s)[1]));
  const many = words.size === 1 ? [...words][0]! : "entités";
  const entities = stores.reduce((n, s) => n + (s.facets.data?.entities.length ?? 0), 0);
  const external = nodes.filter((n) => n.role === "external" || n.role === "managed").length;
  return [
    { value: `${nodes.length} · ${links.length}`, label: "blocs · liens, chacun à sa ligne", screen: "architecture" },
    { value: String(entries.length), label: `points d'entrée · ${unprompted} sans clic`, screen: "features" },
    { value: String(entities), label: `${many} · ${count(stores.length, "stockage")}`, screen: "donnees" },
    { value: String(Object.keys(tech).length), label: `technologies · ${count(external, "service externe", "services externes")}`, screen: "technologies" },
  ];
}
