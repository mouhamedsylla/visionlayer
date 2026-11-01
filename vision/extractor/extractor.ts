import type Parser from "tree-sitter";
import { dirname, join, normalize } from "node:path";
import { parse, hasSyntaxError } from "../parsers/parser.js";
import type { AliasResolver } from "../model/aliases.js";
import type {
  DependencyFact,
  FileFact,
  Language,
  ReExportFact,
  SymbolFact,
  SymbolKind,
} from "../model/types.js";

const DECLARATION_KIND: Record<string, SymbolKind> = {
  function_declaration: "function",
  class_declaration: "class",
  interface_declaration: "interface",
  type_alias_declaration: "type",
  enum_declaration: "enum",
};

const RESOLUTION_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"];

/**
 * Extrait les faits (symboles, dépendances) d'un fichier source.
 * En cas d'erreur de syntaxe : ne tente pas d'extraire, retourne un FileFact
 * avec `parseError` renseigné plutôt que de produire des faits partiels
 * potentiellement trompeurs (cf. ADR 0004).
 */
export function extractFile(
  path: string,
  source: string,
  language: Language,
  knownFiles: Set<string>,
  aliases?: AliasResolver,
): { file: FileFact; dependencies: DependencyFact[]; reExports: ReExportFact[] } {
  const tree = parse(source, language);

  if (hasSyntaxError(tree)) {
    return {
      file: { path, language, symbols: [], parseError: "syntax error detected by parser" },
      dependencies: [],
      reExports: [],
    };
  }

  const symbols: SymbolFact[] = [];
  const dependencies: DependencyFact[] = [];
  const reExports: ReExportFact[] = [];

  for (const node of tree.rootNode.namedChildren) {
    if (node.type === "import_statement") {
      const dep = extractDependency(node, path, knownFiles, aliases);
      if (dep) dependencies.push(dep);
      continue;
    }

    if (node.type === "export_statement") {
      const declaration = node.childForFieldName("declaration");
      if (declaration) {
        symbols.push(...extractSymbolsFromDeclaration(declaration, path, true));
        continue;
      }

      const exportClause = node.namedChildren.find((c) => c.type === "export_clause");
      if (exportClause) {
        reExports.push(...extractReExports(node, exportClause, path, knownFiles, aliases));
        // `export { x } from "./y"` est aussi une dépendance structurelle.
        const dep = extractDependency(node, path, knownFiles, aliases);
        if (dep) dependencies.push(dep);
        continue;
      }

      // `export * from "./x"`, `export default ...` sans clause ni
      // déclaration inline : hors périmètre MVP1, volontairement ignoré —
      // ne doit pas planter, mais ne produit aucun fait.
      continue;
    }

    symbols.push(...extractSymbolsFromDeclaration(node, path, false));
  }

  // `import('./x')` (routes paresseuses : `lazy(() => import(...))`) : une dépendance comme une autre,
  // sinon tout ce qu'une app charge à la demande disparaît de son code (constaté sur un projet réel).
  const seen = new Set(dependencies.map((d) => d.raw));
  collectDynamicImports(tree.rootNode, (raw) => {
    if (seen.has(raw)) return;
    seen.add(raw);
    const dep = dependencyFor(raw, path, knownFiles, aliases);
    dependencies.push(dep);
  });

  return { file: { path, language, symbols }, dependencies, reExports };
}

function collectDynamicImports(node: Parser.SyntaxNode, found: (raw: string) => void): void {
  for (const child of node.namedChildren) {
    if (child.type === "call_expression" && child.childForFieldName("function")?.type === "import") {
      const arg = child.childForFieldName("arguments")?.namedChildren[0];
      if (arg && (arg.type === "string" || (arg.type === "template_string" && !arg.namedChildren.some((c) => c.type === "template_substitution")))) found(arg.text.slice(1, -1));
    }
    collectDynamicImports(child, found);
  }
}

function extractReExports(
  exportStatement: Parser.SyntaxNode,
  exportClause: Parser.SyntaxNode,
  path: string,
  knownFiles: Set<string>,
  aliases?: AliasResolver,
): ReExportFact[] {
  const sourceNode = exportStatement.childForFieldName("source");
  const rawSource = sourceNode ? sourceNode.text.slice(1, -1) : undefined;

  const facts: ReExportFact[] = [];
  for (const specifier of exportClause.namedChildren) {
    if (specifier.type !== "export_specifier") continue;
    const nameNode = specifier.childForFieldName("name");
    if (!nameNode) continue;
    const originalName = nameNode.text;
    const aliasNode = specifier.childForFieldName("alias");
    const exportedName = aliasNode ? aliasNode.text : originalName;

    if (rawSource === undefined) {
      // Ré-export local : `function x() {} export { x };`
      facts.push({ file: path, exportedName, originalName, sourceFile: path, external: false });
    } else if (!rawSource.startsWith(".") && !rawSource.startsWith("/")) {
      const internal = aliases?.(path, rawSource);
      facts.push({ file: path, exportedName, originalName, sourceFile: internal ?? rawSource, external: internal === undefined });
    } else {
      const resolved = resolveRelativeImport(path, rawSource, knownFiles);
      facts.push({
        file: path,
        exportedName,
        originalName,
        sourceFile: resolved ?? rawSource,
        external: false,
      });
    }
  }
  return facts;
}

function extractSymbolsFromDeclaration(
  node: Parser.SyntaxNode,
  path: string,
  exported: boolean,
): SymbolFact[] {
  const kind = DECLARATION_KIND[node.type];

  if (kind) {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return [];
    return [buildSymbol(path, nameNode.text, kind, exported, node)];
  }

  if (node.type === "lexical_declaration") {
    const symbols: SymbolFact[] = [];
    for (const declarator of node.namedChildren) {
      if (declarator.type !== "variable_declarator") continue;
      const nameNode = declarator.childForFieldName("name");
      if (!nameNode) continue;
      symbols.push(buildSymbol(path, nameNode.text, "variable", exported, node));
    }
    return symbols;
  }

  return [];
}

function buildSymbol(
  path: string,
  name: string,
  kind: SymbolKind,
  exported: boolean,
  node: Parser.SyntaxNode,
): SymbolFact {
  return {
    id: `${path}#${name}`,
    name,
    kind,
    exported,
    location: {
      path,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    },
  };
}

function extractDependency(
  node: Parser.SyntaxNode,
  fromPath: string,
  knownFiles: Set<string>,
  aliases?: AliasResolver,
): DependencyFact | undefined {
  const sourceNode = node.childForFieldName("source");
  if (!sourceNode) return undefined;

  const raw = sourceNode.text.slice(1, -1); // retire les guillemets
  return dependencyFor(raw, fromPath, knownFiles, aliases);
}

export function dependencyFor(raw: string, fromPath: string, knownFiles: Set<string>, aliases?: AliasResolver): DependencyFact {
  if (!raw.startsWith(".") && !raw.startsWith("/")) {
    // Alias tsconfig ou paquet du workspace : interne, malgré l'allure de paquet.
    const internal = aliases?.(fromPath, raw);
    return internal ? { from: fromPath, to: internal, raw, external: false } : { from: fromPath, to: raw, raw, external: true };
  }

  const resolved = resolveRelativeImport(fromPath, raw, knownFiles);
  return { from: fromPath, to: resolved ?? raw, raw, external: false };
}

function resolveRelativeImport(
  fromPath: string,
  raw: string,
  knownFiles: Set<string>,
): string | undefined {
  const baseDir = dirname(fromPath);
  // Convention TypeScript NodeNext/ESM : le specifier porte l'extension .js
  // même quand le fichier réel est .ts — on la retire avant de retenter avec
  // chaque extension candidate (cas découvert en scannant ce projet lui-même,
  // cf. tests/fixtures/esm-extension-resolution — ADR 0004).
  // Le fichier écrit tel quel d'abord (`./a.cjs`), puis sans son extension (`./a.mjs` → `a.mts`).
  const exact = normalize(join(baseDir, raw));
  if (knownFiles.has(exact)) return exact;
  const withoutKnownExtension = raw.replace(/\.(js|jsx|ts|tsx|mjs|cjs|mts|cts)$/, "");
  const candidateBase = normalize(join(baseDir, withoutKnownExtension));

  for (const ext of RESOLUTION_EXTENSIONS) {
    const candidate = candidateBase + ext;
    if (knownFiles.has(candidate)) return candidate;
  }
  for (const ext of RESOLUTION_EXTENSIONS) {
    const candidate = join(candidateBase, "index" + ext);
    if (knownFiles.has(candidate)) return candidate;
  }
  return undefined;
}
