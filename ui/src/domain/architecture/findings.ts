import type { Finding } from "../../api/types";
import { count } from "../text/plural";

type Code = Finding["code"];

const LABEL: Record<Code, [string, string]> = {
  uncalled_entry: ["point d'entrée jamais appelé", "points d'entrée jamais appelés"],
  unknown_callable: ["appel vers une fonction introuvable", "appels vers une fonction introuvable"],
  unresolved_target: ["cible non résolue", "cibles non résolues"],
  dynamic_path: ["chemin calculé à l'exécution", "chemins calculés à l'exécution"],
  unguarded_route: ["route sans garde de rôle", "routes sans garde de rôle"],
  race_read_then_write: ["lecture puis écriture sans revérifier", "lectures puis écritures sans revérifier"],
  write_then_enqueue: ["écriture suivie d'un message non garanti", "écritures suivies d'un message non garanti"],
  order_assumption: ["ordre supposé entre deux messages", "ordres supposés entre deux messages"],
  personal_data_logged: ["donnée personnelle écrite dans un journal", "données personnelles écrites dans un journal"],
  scheduled_on_every_instance: ["tâche planifiée lancée sur chaque exemplaire", "tâches planifiées lancées sur chaque exemplaire"],
  doc_contradiction: ["contradiction avec la documentation", "contradictions avec la documentation"],
  unused_value: ["valeur permise que rien n'écrit", "valeurs permises que rien n'écrit"],
  dead_code: ["fonction exportée que rien n'importe", "fonctions exportées que rien n'importe"],
  missing_timeout: ["accès sans délai maximum", "accès sans délai maximum"],
};

export interface FindingGroup {
  code: Code;
  label: string;
  findings: Finding[];
}

/** `5 points d'entrée jamais appelés`. */
export function groupLabel(code: Code, n: number): string {
  const [one, many] = LABEL[code];
  return count(n, one, many);
}

/** Les constats rangés par nature, les plus nombreux d'abord. */
export function groupFindings(findings: Finding[]): FindingGroup[] {
  const groups = new Map<Code, Finding[]>();
  for (const f of findings) groups.set(f.code, [...(groups.get(f.code) ?? []), f]);
  return [...groups.entries()]
    .map(([code, list]) => ({ code, label: groupLabel(code, list.length), findings: list }))
    .sort((a, b) => b.findings.length - a.findings.length || a.code.localeCompare(b.code));
}

export function findingsOf(nodeId: string, findings: Finding[]): Finding[] {
  return findings.filter((f) => f.nodes?.includes(nodeId));
}
