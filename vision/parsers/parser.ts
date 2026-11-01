import Parser from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import JavaScript from "tree-sitter-javascript";
import type { Language } from "../model/types.js";

const LANGUAGE_GRAMMARS: Record<Language, unknown> = {
  typescript: TypeScript.typescript,
  tsx: TypeScript.tsx,
  javascript: JavaScript,
  jsx: JavaScript,
};

/** La grammaire tree-sitter d'un langage (pour compiler des requêtes de motifs). */
export function grammarFor(language: Language): unknown {
  return LANGUAGE_GRAMMARS[language];
}

const DEFAULT_BUFFER_SIZE = 32 * 1024;

function parseRaw(source: string, language: Language): Parser.Tree {
  const parser = new Parser();
  parser.setLanguage(LANGUAGE_GRAMMARS[language]);
  // Le binding Node de tree-sitter lit la source par tampon de 32 Kio et
  // échoue (« Invalid argument ») sur tout fichier plus gros si on ne lui
  // donne pas un tampon à la taille du fichier — trouvé en scannant un projet réel
  // (videoCourses.ts, 328 Ko).
  const bytes = Buffer.byteLength(source, "utf-8");
  return parser.parse(source, undefined, { bufferSize: Math.max(DEFAULT_BUFFER_SIZE, bytes + 1) });
}

/**
 * Analyse un fichier. Seule exception à « une erreur = pas de faits »
 * (ADR 0004) : la grammaire tree-sitter refuse un `&` nu dans du texte JSX
 * (`<div>Crédits & sources</div>`), que TypeScript et Babel acceptent — 9
 * fichiers d'un projet réel étaient écartés pour ça. Un tel `&` ne porte aucun fait
 * (ni symbole ni import) : il est remplacé par une espace, octet pour octet,
 * donc toutes les positions restent exactes, et le fichier est ré-analysé.
 * Le résultat n'est accepté que si l'arbre est alors entièrement valide.
 */
export function parse(source: string, language: Language): Parser.Tree {
  let tree = parseRaw(source, language);
  if (!tree.rootNode.hasError || (language !== "tsx" && language !== "jsx")) return tree;
  let patched = source;
  for (let attempt = 0; attempt < 50 && tree.rootNode.hasError; attempt++) {
    const at = bareAmpersandInJsx(tree, patched);
    if (at === undefined) return tree;
    patched = patched.slice(0, at) + " " + patched.slice(at + 1);
    tree = parseRaw(patched, language);
  }
  return tree;
}

const JSX_NODES = new Set(["jsx_element", "jsx_fragment", "jsx_self_closing_element", "jsx_opening_element"]);

/**
 * Index du premier `&` nu (ni `&&`, ni entité `&amp;`) situé en texte ou en
 * valeur d'attribut JSX — hors `{…}` — entre le début de l'élément JSX qui
 * contient une erreur et la fin de cette erreur. Les index de tree-sitter
 * (binding Node) sont en unités UTF-16, comme les chaînes JavaScript.
 */
function bareAmpersandInJsx(tree: Parser.Tree, source: string): number | undefined {
  const errors: Parser.SyntaxNode[] = [];
  const walk = (n: Parser.SyntaxNode): void => {
    if (n.type === "ERROR") errors.push(n);
    else if (n.hasError) for (const c of n.children) walk(c);
  };
  walk(tree.rootNode);
  for (const err of errors) {
    let jsx: Parser.SyntaxNode | null = null;
    for (let p = err.parent; p && !jsx; p = p.parent) if (JSX_NODES.has(p.type)) jsx = p;
    if (!jsx) {
      // Un `&` dans une valeur d'attribut (`title="Crédits &"`) peut faire échouer tout
      // l'élément : aucun ancêtre JSX. On cherche alors un attribut `nom="…&…"` (sans
      // espace autour du `=`, forme propre au JSX) dans le texte de l'erreur.
      const text = source.slice(err.startIndex, err.endIndex);
      const m = /[\w-]=(["'])([^"'\n]*?)&(?!&|#?\w+;)/.exec(text);
      if (m) return err.startIndex + m.index + m[0].length - 1;
      continue;
    }
    let depth = 0;
    for (let i = jsx.startIndex; i < err.endIndex; i++) {
      const ch = source[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth = Math.max(0, depth - 1);
      else if (ch === "&" && depth === 0) {
        if (source[i + 1] === "&" || source[i - 1] === "&") continue;
        if (/^&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/i.test(source.slice(i, i + 12))) continue;
        return i;
      }
    }
  }
  return undefined;
}

export function hasSyntaxError(tree: Parser.Tree): boolean {
  return tree.rootNode.hasError;
}
