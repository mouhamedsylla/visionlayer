import type { EdgeKind, FindingCode, NodeRole } from "../api/types";

/** Ce qu'est un bloc, dit comme un ingénieur le dit (C4) : application, service, base de données, file. */
export const ROLE: Record<NodeRole, string> = {
  actor: "personne", external: "service extérieur", app: "application", service: "service", function: "fonction",
  worker: "worker", job: "tâche", store: "base de données", channel: "file de messages", binary: "programme",
  managed: "service géré", module: "module", layer: "couche", adapter: "adaptateur",
};

/** Le verbe d'un lien, conjugué au nombre de ses lignes : « 21 écritures », « 8 appels ». */
export function edgeCount(kind: EdgeKind, n: number): string {
  const word: Record<EdgeKind, [string, string]> = {
    call: ["appel", "appels"], read: ["lecture", "lectures"], write: ["écriture", "écritures"], message: ["mise en file", "mises en file"],
    request: ["appel", "appels"], trigger: ["déclenchement", "déclenchements"], use: ["import", "imports"], deploy: ["déploiement", "déploiements"],
  };
  return `${n} ${word[kind][n > 1 ? 1 : 0]}`;
}

/** Le verbe d'un lien dans une phrase : « API écrit dans postgres ». */
export const EDGE_VERB: Record<EdgeKind, string> = {
  call: "appelle", read: "lit", write: "écrit dans", message: "met en file sur", request: "appelle",
  trigger: "réveille", use: "emploie", deploy: "déploie",
};

/** L'écran qui répond à un constat : où aller le comprendre. */
export const FINDING_SCREEN: Partial<Record<FindingCode, "acces" | "donnees" | "carte" | "taches">> = {
  unguarded_route: "acces", personal_data_logged: "donnees", unused_value: "donnees", race_read_then_write: "donnees", read_outside_tx: "donnees",
  write_then_enqueue: "donnees", scheduled_on_every_instance: "taches", missing_timeout: "carte", uncalled_entry: "carte", dead_code: "carte",
};

/** Un constat porte une preuve dans le code : rouge. Une hygiène (code mort, valeur jamais écrite) : à surveiller. */
export const FINDING_TONE: Record<FindingCode, "critical" | "signal"> = {
  unguarded_route: "critical", personal_data_logged: "critical", race_read_then_write: "critical", read_outside_tx: "critical", write_then_enqueue: "critical",
  scheduled_on_every_instance: "critical", missing_timeout: "critical", doc_contradiction: "critical", order_assumption: "critical",
  uncalled_entry: "signal", unknown_callable: "signal", unresolved_target: "signal", dynamic_path: "signal", unused_value: "signal", dead_code: "signal",
};

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

/** « il y a 4 min », « il y a 2 h », à partir d'une date ISO. */
export function since(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}
