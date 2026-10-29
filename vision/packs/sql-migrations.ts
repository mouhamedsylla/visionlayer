import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { sqlTablesOfText } from "./sql.js";

/**
 * Les fichiers SQL du dépôt (migrations), d'après docs/fonctionnement/packs/sql-migrations.md :
 * ce qui s'exécute dans la base quand une table change.
 *
 * sql_trigger(Fichier, Nom, Opérations, Table, Routine)   CREATE TRIGGER audit AFTER UPDATE ON bookings … EXECUTE FUNCTION audit_fn() ;
 *                                                         Opérations : insert, update, delete, séparées par des virgules ;
 *                                                         sans EXECUTE (corps écrit sur place), la routine porte le nom du déclencheur
 * sql_routine_access(Fichier, Routine, read|write, Table) ce que lit ou écrit le corps d'une fonction ou d'un déclencheur
 *
 * Les tables créées par CREATE TABLE ne sont pas lues ici : le schéma du code (Drizzle) en est la source.
 */
const TRIGGER = /create\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\s+(?:if\s+not\s+exists\s+)?"?([\w.]+)"?\s+(?:before|after|instead\s+of)\s+([\s\S]+?)\s+on\s+"?([\w.]+)"?([\s\S]*?)(?:;|$)/gi;
const ROUTINE = /create\s+(?:or\s+replace\s+)?(?:function|procedure)\s+"?([\w.]+)"?\s*\([\s\S]*?(\$\w*\$)([\s\S]*?)\2/gi;

const script: PackScript = ({ file, fact }) => {
  const src = file.source.replace(/--[^\n]*/g, (c) => " ".repeat(c.length));
  const lineAt = (i: number) => src.slice(0, i).split("\n").length;
  const out: FileFact[] = [];
  for (const m of src.matchAll(ROUTINE)) {
    for (const t of sqlTablesOfText(m[3]!)) if ("name" in t) out.push(fact("sql_routine_access", [file.path, m[1]!, t.op, t.name], lineAt(m.index!)));
  }
  for (const m of src.matchAll(TRIGGER)) {
    const ops = [...new Set(m[2]!.split(/\s+or\s+/i).map((o) => o.trim().split(/\s+/)[0]!.toLowerCase()).filter((o) => ["insert", "update", "delete"].includes(o)))];
    if (!ops.length) continue;
    const exec = m[4]!.match(/execute\s+(?:function|procedure)\s+"?([\w.]+)"?/i);
    const routine = exec ? exec[1]! : m[1]!;
    const line = lineAt(m.index!);
    out.push(fact("sql_trigger", [file.path, m[1]!, ops.join(","), m[3]!, routine], line));
    if (!exec) for (const t of sqlTablesOfText(m[4]!)) if ("name" in t) out.push(fact("sql_routine_access", [file.path, routine, t.op, t.name], line));
  }
  return out;
};

export default script;
