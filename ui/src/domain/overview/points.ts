import type { Finding, Proof } from "../../api/types";
import type { IconName } from "../../shell/icons";
import { groupFindings } from "../architecture/findings";

type Code = Finding["code"];

/** Le mot court posé devant un point, et son icône : ce que le point concerne. */
const TAG: Record<Code, [string, IconName]> = {
  uncalled_entry: ["route", "features"],
  unknown_callable: ["analyse", "coverage"],
  unresolved_target: ["analyse", "coverage"],
  dynamic_path: ["analyse", "coverage"],
  unguarded_route: ["accès", "check"],
  race_read_then_write: ["courses", "state"],
  write_then_enqueue: ["file", "messages"],
  order_assumption: ["file", "messages"],
  personal_data_logged: ["perso", "data"],
  scheduled_on_every_instance: ["planifié", "clock"],
  doc_contradiction: ["doc", "knowledge"],
  unused_value: ["données", "data"],
  dead_code: ["code", "code"],
  missing_timeout: ["panne", "trigger"],
};

/** Une ligne de « Ce qu'il faut savoir » : une nature de point, ses constats, et les blocs qu'ils touchent. */
export interface PointRow {
  code: Code;
  tag: string;
  icon: IconName;
  /** `5 points d'entrée jamais appelés`. */
  label: string;
  findings: Finding[];
  /** Les blocs concernés, sans doublon, dans l'ordre où les constats les citent. */
  nodes: string[];
  /** La première ligne qui prouve le premier constat. */
  proof?: Proof;
}

/** Les points à vérifier, une ligne par nature, les plus nombreux d'abord. */
export function pointRows(findings: Finding[]): PointRow[] {
  return groupFindings(findings).map((g) => {
    const [tag, icon] = TAG[g.code];
    return {
      code: g.code, tag, icon, label: g.label, findings: g.findings,
      nodes: [...new Set(g.findings.flatMap((f) => f.nodes ?? []))],
      proof: g.findings[0]?.proof[0],
    };
  });
}

/** Où regarder pour une ligne : `src/jobs/expire.ts · l.13`. */
export function whereLabel(proof: Pick<Proof, "path" | "line">): string {
  return proof.line > 0 ? `${proof.path} · l.${proof.line}` : proof.path;
}

/**
 * Ce dont parle un constat, pour le nommer sur le dessin : le sujet cité
 * (`« POST /auth/reset »`), ou un identifiant en tête (`users.role`,
 * `expireHolds`) ; rien quand la phrase commence par un mot ordinaire.
 */
export function findingSubject(message: string): string | undefined {
  const quoted = message.match(/^«\s*([^»]+?)\s*»/);
  if (quoted) return quoted[1];
  const ticked = message.match(/^`([^`]+)`/);
  if (ticked) return ticked[1];
  const first = message.split(/\s/)[0] ?? "";
  return /^[\w$]+([.][\w$]+|[A-Z][\w$]*)+$/.test(first) ? first : undefined;
}
