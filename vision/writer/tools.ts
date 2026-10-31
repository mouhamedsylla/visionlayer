import type Parser from "tree-sitter";
import type { Language } from "../model/types.js";
import { parse } from "../parsers/parser.js";
import type { Pack } from "../facts/packs.js";
import { checkPack } from "../facts/registry.js";

/**
 * Les outils de l'agent qui écrit un pack. Aucun ne lit le projet ouvert : l'arbre d'un exemple que
 * l'agent écrit lui-même, et la vérification d'un pack dans des dossiers à part.
 */

/** L'arbre que voit tree-sitter, un nœud nommé par ligne, avec son champ, sa ligne, et le texte des feuilles. */
export function syntaxTree(code: string, language: Language = "typescript"): string {
  const lines: string[] = [];
  const walk = (n: Parser.SyntaxNode, depth: number, field: string | null) => {
    const leaf = n.namedChildCount === 0;
    lines.push(`${"  ".repeat(depth)}${field ? `${field}: ` : ""}(${n.type})  L${n.startPosition.row + 1}${leaf ? `  ${JSON.stringify(n.text.slice(0, 60))}` : ""}`);
    for (let i = 0; i < n.childCount; i++) {
      const c = n.child(i)!;
      if (c.isNamed) walk(c, depth + 1, n.fieldNameForChild(i));
    }
  };
  walk(parse(code, language).rootNode, 0, null);
  return lines.join("\n");
}

/** `check_pack` : les vérifications du registre, et pour chaque test ce qu'il a donné. Rend du texte pour l'agent. */
export async function checkForAgent(yaml: string, builtins: Pack[]): Promise<{ ok: boolean; text: string }> {
  const r = await checkPack(yaml, builtins);
  const out = [r.state.status === "failed" ? `REFUSÉ : ${r.state.reason}` : `ACCEPTÉ : produit ${r.state.provides.join(", ")}`];
  for (const t of r.tests ?? []) {
    out.push(`\n[${t.ok ? "ok" : "ÉCHEC"}] ${t.name}`);
    for (const p of t.problems) out.push(`  - ${p}`);
    out.push(t.produced.length ? `  faits produits (${t.produced.length}) :` : "  aucun fait produit par le pack");
    for (const f of t.produced.slice(0, 40)) out.push(`    ${f}`);
    if (t.produced.length > 40) out.push(`    … ${t.produced.length - 40} de plus`);
  }
  return { ok: r.state.status !== "failed", text: out.join("\n") };
}
