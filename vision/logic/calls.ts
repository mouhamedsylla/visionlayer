import type Parser from "tree-sitter";
import { parse, hasSyntaxError } from "../parsers/parser.js";
import type { SymbolFact, SystemModel } from "../model/types.js";
import { findFile, dependenciesOf } from "../model/query.js";

export type CallTarget =
  | { kind: "import"; file: string; external: boolean; importedName: string }
  | { kind: "local"; file: string; line: number }
  | { kind: "unresolved" };

export interface CallStep {
  order: number;
  callee: string;
  line: number;
  target: CallTarget;
}

export interface CallSequence {
  symbol: SymbolFact;
  steps: CallStep[];
  /** Faits calculables sur le corps : utiles pour la lecture, jamais interprétés. */
  facts: {
    branches: number;
    loops: number;
    returnType?: string;
  };
}

const BRANCH_TYPES = new Set(["if_statement", "switch_statement", "ternary_expression", "conditional_expression"]);
const LOOP_TYPES = new Set(["for_statement", "for_in_statement", "while_statement", "do_statement"]);
const NESTED_SCOPE_TYPES = new Set(["function_declaration", "arrow_function", "function_expression", "method_definition"]);

/**
 * Niveau « Logique » de l'interface : la séquence des appels sortants d'un
 * symbole, dans l'ordre du code. Calculée à la demande à partir du fichier
 * source (pas stockée dans model.json — le modèle reste au niveau fichier,
 * ADR 0003) ; chaque appel est résolu vers un import du fichier, un symbole
 * local, ou laissé non résolu — jamais deviné.
 */
export function buildCallSequence(model: SystemModel, symbol: SymbolFact, source: string): CallSequence | undefined {
  const file = findFile(model, symbol.location.path);
  if (!file) return undefined;
  const tree = parse(source, file.language);
  if (hasSyntaxError(tree)) return undefined;

  const declaration = findDeclaration(tree.rootNode, symbol);
  if (!declaration) return undefined;

  const imports = importBindings(tree.rootNode);
  const deps = dependenciesOf(model, file.path);
  const localSymbols = new Map(file.symbols.map((s) => [s.name, s]));

  const steps: CallStep[] = [];
  let branches = 0;
  let loops = 0;

  const body = declaration.childForFieldName("body") ?? declaration;
  walk(body, (node) => {
    if (BRANCH_TYPES.has(node.type)) branches++;
    if (LOOP_TYPES.has(node.type)) loops++;
    if (node.type !== "call_expression") return;
    const fn = node.childForFieldName("function");
    if (!fn) return;
    const callee = fn.text;
    const rootIdentifier = fn.type === "identifier" ? fn.text : undefined;
    steps.push({
      order: steps.length + 1,
      callee,
      line: node.startPosition.row + 1,
      target: resolveTarget(rootIdentifier, imports, deps, localSymbols, file.path),
    });
  });

  const returnTypeNode = declaration.childForFieldName("return_type");
  return {
    symbol,
    steps,
    facts: {
      branches,
      loops,
      returnType: returnTypeNode ? returnTypeNode.text.replace(/^:\s*/, "") : undefined,
    },
  };
}

function findDeclaration(root: Parser.SyntaxNode, symbol: SymbolFact): Parser.SyntaxNode | undefined {
  let found: Parser.SyntaxNode | undefined;
  walk(root, (node) => {
    if (found) return;
    if (node.startPosition.row + 1 !== symbol.location.startLine) return;
    const nameNode = node.childForFieldName("name");
    if (!nameNode || nameNode.text !== symbol.name) return;
    // `const f = () => {}` : la logique vit dans la valeur, pas dans le déclarateur.
    const value = node.type === "variable_declarator" ? node.childForFieldName("value") : undefined;
    found = value && NESTED_SCOPE_TYPES.has(value.type) ? value : node;
  });
  return found;
}

/** Nom local → nom importé + specifier brut, pour `import { a as b } from "x"` et `import x from "x"`. */
function importBindings(root: Parser.SyntaxNode): Map<string, { importedName: string; raw: string }> {
  const bindings = new Map<string, { importedName: string; raw: string }>();
  for (const node of root.namedChildren) {
    if (node.type !== "import_statement") continue;
    const sourceNode = node.childForFieldName("source");
    if (!sourceNode) continue;
    const raw = sourceNode.text.slice(1, -1);
    walk(node, (n) => {
      if (n.type === "import_specifier") {
        const name = n.childForFieldName("name")?.text;
        const alias = n.childForFieldName("alias")?.text;
        if (name) bindings.set(alias ?? name, { importedName: name, raw });
      } else if (n.type === "namespace_import") {
        const id = n.namedChildren.find((c) => c.type === "identifier")?.text;
        if (id) bindings.set(id, { importedName: "*", raw });
      } else if (n.type === "identifier" && n.parent?.type === "import_clause") {
        bindings.set(n.text, { importedName: "default", raw });
      }
    });
  }
  return bindings;
}

function resolveTarget(
  identifier: string | undefined,
  imports: Map<string, { importedName: string; raw: string }>,
  deps: ReturnType<typeof dependenciesOf>,
  localSymbols: Map<string, SymbolFact>,
  currentFile: string,
): CallTarget {
  if (!identifier) return { kind: "unresolved" };
  const binding = imports.get(identifier);
  if (binding) {
    const dep = deps.find((d) => d.raw === binding.raw);
    if (dep) return { kind: "import", file: dep.to, external: dep.external, importedName: binding.importedName };
    return { kind: "import", file: binding.raw, external: true, importedName: binding.importedName };
  }
  const local = localSymbols.get(identifier);
  if (local) return { kind: "local", file: currentFile, line: local.location.startLine };
  return { kind: "unresolved" };
}

/** Parcours en profondeur, dans l'ordre du source, sans entrer dans les fonctions imbriquées. */
function walk(node: Parser.SyntaxNode, visit: (n: Parser.SyntaxNode) => void): void {
  for (const child of node.namedChildren) {
    visit(child);
    if (NESTED_SCOPE_TYPES.has(child.type)) continue;
    walk(child, visit);
  }
}
