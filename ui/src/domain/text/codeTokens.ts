/** Une teinte par morceau de ligne : de quoi lire le code d'un coup d'œil, sans prétendre être un analyseur. */
export type CodeTone = "plain" | "comment" | "string" | "keyword";
export interface CodeToken {
  text: string;
  tone: CodeTone;
}

const KEYWORDS = new Set([
  "import", "export", "from", "default", "const", "let", "var", "function", "return", "async", "await", "if", "else", "new", "class",
  "interface", "type", "extends", "implements", "switch", "case", "throw", "try", "catch", "finally", "for", "of", "in", "while",
  "def", "self", "None", "True", "False", "func", "package", "struct", "fn", "pub", "use", "impl", "null", "undefined", "true", "false",
]);

// un commentaire de fin de ligne, un début de bloc, une chaîne, un mot
const PIECE = /(\/\/.*$|(?<![\w$&])#(?:\s|!|$).*$|\/\*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|([A-Za-z_$][\w$]*)/g;

/**
 * Découpe des lignes de code en morceaux teintés. Un commentaire `/* … *\/`
 * ouvert sur une ligne continue sur les suivantes jusqu'à sa fermeture.
 */
export function codeTokens(lines: string[]): CodeToken[][] {
  let inBlock = false;
  return lines.map((line) => {
    const out: CodeToken[] = [];
    let rest = line;
    if (inBlock) {
      const end = rest.indexOf("*/");
      if (end < 0) return [{ text: rest, tone: "comment" }];
      out.push({ text: rest.slice(0, end + 2), tone: "comment" });
      rest = rest.slice(end + 2);
      inBlock = false;
    }
    let at = 0;
    const piece = new RegExp(PIECE.source, "g");
    for (let m = piece.exec(rest); m; m = piece.exec(rest)) {
      const start = m.index;
      if (start > at) out.push({ text: rest.slice(at, start), tone: "plain" });
      if (m[1] === "/*") {
        const end = rest.indexOf("*/", start + 2);
        at = end < 0 ? rest.length : end + 2;
        out.push({ text: rest.slice(start, at), tone: "comment" });
        inBlock = end < 0;
        piece.lastIndex = at;
        continue;
      }
      out.push({ text: m[0], tone: m[1] ? "comment" : m[2] ? "string" : KEYWORDS.has(m[0]) ? "keyword" : "plain" });
      at = start + m[0].length;
    }
    if (at < rest.length) out.push({ text: rest.slice(at), tone: "plain" });
    return out;
  });
}
