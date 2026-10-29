import type { ArchModelV2, ArchNode, Entity } from "../../api/types";
import { count } from "../text/plural";
import { usersOf, writersOf, type StoreAccess } from "./actors";
import { controlsOf, writtenByTriggers } from "./controls";
import { entityFindings } from "./findings";
import { entityWord } from "./stores";

/** Une phrase courte du bandeau ; `attention` quand elle demande qu'on aille voir. */
export interface StoreNote {
  text: string;
  tone: "attention" | "plain";
}

/**
 * Ce qu'il faut savoir d'un stockage, en quelques mots, chacun compté sur la carte :
 * `3 tables écrites de plusieurs côtés`, `10 tables sans contrôle`.
 * Une phrase dont le compte est nul n'est pas dite.
 */
export function storeNotes(store: ArchNode, entities: Entity[], access: StoreAccess, model: ArchModelV2): StoreNote[] {
  const [one, many] = entityWord(store);
  const n = (k: number, rest: string, restMany = rest) => `${count(k, one, many)} ${k > 1 ? restMany : rest}`;
  const shared = entities.filter((e) => writersOf(access, e.name).length > 1).length;
  const unguarded = entities.filter((e) => controlsOf(e).length === 0).length;
  const byTrigger = entities.filter((e) => writtenByTriggers(e, entities).length > 0).length;
  const untouched = entities.filter((e) => usersOf(access, e.name).length === 0).length;
  const flagged = new Set(entities.flatMap((e) => entityFindings(e, store, model))).size;
  const notes: (StoreNote | false)[] = [
    flagged > 0 && { text: count(flagged, "constat à vérifier", "constats à vérifier"), tone: "attention" },
    shared > 0 && { text: n(shared, "écrite de plusieurs côtés", "écrites de plusieurs côtés"), tone: "attention" },
    store.facets.data?.shape === "relational" && unguarded > 0 && { text: n(unguarded, "sans contrôle"), tone: "attention" },
    byTrigger > 0 && { text: n(byTrigger, "écrite par un déclencheur", "écrites par un déclencheur"), tone: "plain" },
    untouched > 0 && { text: n(untouched, "que le code ne lit ni n'écrit"), tone: "plain" },
  ];
  return notes.filter((x): x is StoreNote => !!x);
}
