import { templateParts, type Node } from "../arch/ast.js";

export type SqlTable = { op: "read" | "write"; name: string } | { op: "read" | "write"; var: string };

/** Les tables nommées par un gabarit SQL ; une table substituée (`${notes}`) est rendue par sa variable. */
export function sqlTables(tpl: Node): SqlTable[] {
  let text = "";
  const vars: string[] = [];
  for (const p of templateParts(tpl)) {
    if ("text" in p) text += p.text;
    else { text += ` \u0000${vars.length} `; vars.push(p.expr?.type === "identifier" ? p.expr.text : ""); }
  }
  return sqlTablesOfText(text, vars);
}

/** Les tables nommées par un SQL : après FROM et JOIN on lit ; après INTO, UPDATE, DELETE FROM on écrit. */
export function sqlTablesOfText(text: string, vars: string[] = []): SqlTable[] {
  const ctes = new Set([...text.matchAll(/\b(?:with|,)\s+(\w+)\s+as\s*\(/gi)].map((m) => m[1]!.toLowerCase()));
  const out: SqlTable[] = [];
  const re = /\b(delete\s+from|insert\s+into|update|from|join)\s+(?:only\s+)?(\u0000\d+|"?[A-Za-z_][\w$]*"?(?:\."?[A-Za-z_][\w$]*"?)?)/gi;
  for (const m of text.matchAll(re)) {
    const kw = m[1]!.toLowerCase().replace(/\s+/g, " ");
    const op = kw === "from" || kw === "join" ? "read" : "write";
    const target = m[2]!;
    if (target.startsWith("\u0000")) { const v = vars[Number(target.slice(1))]; if (v) out.push({ op, var: v }); continue; }
    const name = target.replace(/"/g, "");
    if (ctes.has(name.toLowerCase()) || /^(select|lateral|unnest|generate_series)$/i.test(name)) continue;
    out.push({ op, name });
  }
  return out;
}
