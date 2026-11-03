import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";

/**
 * Le schéma Prisma (`*.prisma`), d'après docs/fonctionnement/packs/prisma.md (formes S1 à S8).
 * Les entités portent le nom de leur accès dans le client : `model OrderItem` → `orderItem`.
 *
 * prisma_provider(Fichier, Fournisseur)                        datasource db { provider = "postgresql" }
 * prisma_model(Fichier, Entité)                                model Order { … } → order
 * prisma_field(Fichier, Entité, Champ, Type, null|notnull)     un champ scalaire ou d'énumération
 * prisma_value(Fichier, Entité, Champ, Valeur)                 une valeur de l'énumération qui type le champ
 * prisma_default(Fichier, Entité, Champ, Valeur)               @default(PENDING), @default(0) : littéral seulement
 * prisma_cons(Fichier, Entité, Genre, Champs)                  primary, unique, index ; Champs séparés par des virgules
 * prisma_ref(Fichier, Entité, Champs, Visée, Suppression)      @relation(fields: [userId], …, onDelete: SetNull) ; "" sans onDelete
 * prisma_comment(Fichier, Entité, Champ|"", Texte)             le commentaire de l'auteur sur un champ, ou sur le modèle ("")
 */
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const SEPARATOR = /^[-=*#─\s]*$/;
const listOf = (s?: string) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean).join(",");

const script: PackScript = ({ file, fact }) => {
  const out: FileFact[] = [];
  const lines = file.source.split("\n");
  const enums = new Map<string, string[]>();
  const models = new Set<string>();

  // Premier passage : les noms des modèles et les valeurs des énumérations, déclarés dans n'importe quel ordre.
  let open: { kind: string; name: string } | undefined;
  for (const raw of lines) {
    const l = raw.replace(/\/\/.*$/, "").trim();
    const head = l.match(/^(model|enum|datasource|generator|view|type)\s+(\w+)\s*\{/);
    if (head) { open = { kind: head[1]!, name: head[2]! }; if (head[1] === "model") models.add(head[2]!); if (head[1] === "enum") enums.set(head[2]!, []); continue; }
    if (l.startsWith("}")) { open = undefined; continue; }
    if (open?.kind === "enum" && /^\w+/.test(l) && !l.startsWith("@@")) enums.get(open.name)!.push(l.match(/^\w+/)![0]);
  }

  // Les commentaires qui précèdent une ligne, sans les séparations.
  let pending: string[] = [];
  // Le bloc de commentaires séparé d'un modèle par une ligne vide (un titre de section) reste le sien.
  let parked = "";
  const comment = (text: string) => text.replace(/^\/\/\/?\s?/, "").trim();
  open = undefined;
  lines.forEach((raw, i) => {
    const line = i + 1;
    const t = raw.trim();
    if (/^\/\//.test(t)) { const c = comment(t); if (!SEPARATOR.test(c)) pending.push(c); return; }
    if (!t) { if (pending.length) parked = pending.join(" "); pending = []; return; }
    const above = pending.join(" ");
    const header = above || parked;
    pending = [];
    parked = "";
    const trailing = raw.match(/\s\/\/\/?\s?(.*)$/)?.[1]?.trim() ?? "";
    const l = raw.replace(/\s\/\/.*$/, "").trim();

    const head = l.match(/^(model|enum|datasource|generator|view|type)\s+(\w+)\s*\{/);
    if (head) {
      open = { kind: head[1]!, name: head[2]! };
      if (head[1] === "model") {
        out.push(fact("prisma_model", [file.path, lowerFirst(head[2]!)], line));
        if (header) out.push(fact("prisma_comment", [file.path, lowerFirst(head[2]!), "", header], line));
      }
      return;
    }
    if (l.startsWith("}")) { open = undefined; return; }
    if (open?.kind === "datasource") {
      const p = l.match(/^provider\s*=\s*"(\w+)"/);
      if (p) out.push(fact("prisma_provider", [file.path, p[1]!], line));
      return;
    }
    if (open?.kind !== "model") return;
    const entity = lowerFirst(open.name);

    // @@id([a, b]), @@unique([a, b]), @@index([a])
    const block = l.match(/^@@(id|unique|index)\s*\(\s*(?:fields\s*:\s*)?\[([^\]]*)\]/);
    if (block) { out.push(fact("prisma_cons", [file.path, entity, block[1] === "id" ? "primary" : block[1]!, listOf(block[2])], line)); return; }
    if (l.startsWith("@@")) return;

    const f = l.match(/^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/);
    if (!f) return;
    const [, name, type, list, opt, attrs] = f as unknown as [string, string, string, string | undefined, string | undefined, string];
    if (models.has(type)) {
      const rel = attrs.match(/@relation\(([^)]*)\)/)?.[1];
      const fields = rel?.match(/fields\s*:\s*\[([^\]]*)\]/)?.[1];
      if (fields) out.push(fact("prisma_ref", [file.path, entity, listOf(fields), lowerFirst(type), rel!.match(/onDelete\s*:\s*(\w+)/)?.[1] ?? ""], line));
      return;
    }
    out.push(fact("prisma_field", [file.path, entity, name, list ? `${type}[]` : type, opt ? "null" : "notnull"], line));
    for (const v of enums.get(type) ?? []) out.push(fact("prisma_value", [file.path, entity, name, v], line));
    const def = attrs.match(/@default\(\s*("([^"]*)"|-?\d+(?:\.\d+)?|true|false|\w+)\s*\)/);
    if (def) {
      const v = def[2] ?? def[1]!;
      const literalValue = def[2] !== undefined || /^-?\d/.test(v) || v === "true" || v === "false" || (enums.get(type) ?? []).includes(v);
      if (literalValue) out.push(fact("prisma_default", [file.path, entity, name, v], line));
    }
    if (/@id\b/.test(attrs)) out.push(fact("prisma_cons", [file.path, entity, "primary", name], line));
    if (/@unique\b/.test(attrs)) out.push(fact("prisma_cons", [file.path, entity, "unique", name], line));
    const said = [above, trailing].filter(Boolean).join(" ");
    if (said) out.push(fact("prisma_comment", [file.path, entity, name, said], line));
  });
  return out;
};

export default script;
