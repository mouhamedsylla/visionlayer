import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { LineCounter, parseDocument, isMap, isSeq, type YAMLMap } from "yaml";
import { z } from "zod";
import { CLAIM_TYPES, CONCEPT_KINDS, UNANCHORED_TYPES, type AnchorRef, type DeclaredConcept } from "./types.js";

export const KNOWLEDGE_DIR = ".vision/knowledge";

const ClaimSchema = z.object({
  id: z.string().min(1),
  type: z.enum(CLAIM_TYPES),
  text: z.string().min(1),
  anchor: z.string().optional(),
  anchors: z.array(z.string()).optional(),
  /** Reconfirmation : changer cette ligne fait avancer le point de référence (git blame). */
  confirmed: z.string().optional(),
});

const ConceptSchema = z.object({
  concept: z.string().min(1),
  kind: z.enum(CONCEPT_KINDS),
  name: z.string().min(1),
  entries: z.array(z.string()).optional(),
  claims: z.array(ClaimSchema).default([]),
});

const ANCHOR = /^([^#@\s]+)(?:#([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?))?(?:@([\w.-]+))?$/;

/** `chemin[#Symbole][@marqueur]` ; le chemin est relatif à la racine du dépôt. */
export function parseAnchor(raw: string): AnchorRef | undefined {
  const m = raw.trim().match(ANCHOR);
  // Jamais hors du dépôt, jamais un fichier d'environnement (seuls ses noms de variables sont lus, ailleurs).
  if (!m || m[1]!.startsWith("/") || m[1]!.split("/").includes("..") || /(^|\/)\.env(\.|$)/.test(m[1]!)) return undefined;
  return { raw: raw.trim(), path: m[1]!, symbol: m[2], marker: m[3] };
}

function yamlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...yamlFiles(p));
    else if (/\.ya?ml$/.test(name)) out.push(p);
  }
  return out;
}

/** Lit tous les fichiers de `.vision/knowledge/`. Un fichier invalide est signalé, jamais bloquant pour les autres. */
export function loadKnowledge(root: string): { concepts: DeclaredConcept[]; errors: { file: string; message: string }[] } {
  const concepts: DeclaredConcept[] = [];
  const errors: { file: string; message: string }[] = [];
  const seen = new Set<string>();
  for (const abs of yamlFiles(join(root, KNOWLEDGE_DIR))) {
    const file = relative(root, abs);
    const source = readFileSync(abs, "utf-8");
    const lc = new LineCounter();
    const doc = parseDocument(source, { lineCounter: lc });
    if (doc.errors.length) {
      errors.push({ file, message: doc.errors[0]!.message });
      continue;
    }
    const parsed = ConceptSchema.safeParse(doc.toJS());
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      errors.push({ file, message: `${issue.path.join(".")} : ${issue.message}` });
      continue;
    }
    const data = parsed.data;
    const claimNodes = (doc.contents as YAMLMap).get("claims", true);
    const ranges = isSeq(claimNodes) ? claimNodes.items.map((n) => (isMap(n) && n.range ? n.range : undefined)) : [];
    const claims: DeclaredConcept["claims"] = [];
    data.claims.forEach((c, i) => {
      if (seen.has(c.id)) {
        errors.push({ file, message: `identifiant en double : ${c.id}` });
        return;
      }
      seen.add(c.id);
      const raws = [...(c.anchor ? [c.anchor] : []), ...(c.anchors ?? [])];
      const anchors = raws.map(parseAnchor);
      if (anchors.some((a) => !a)) {
        errors.push({ file, message: `${c.id} : ancrage mal formé (${raws.filter((r) => !parseAnchor(r)).join(", ")})` });
        return;
      }
      if (!anchors.length && !UNANCHORED_TYPES.includes(c.type)) {
        errors.push({ file, message: `${c.id} : une affirmation « ${c.type} » doit être ancrée dans le code` });
        return;
      }
      const r = ranges[i];
      const start = r ? lc.linePos(r[0]).line : 1;
      const end = r ? lc.linePos(Math.max(r[0], r[1] - 1)).line : start;
      claims.push({ id: c.id, type: c.type, text: c.text.trim(), anchors: anchors as AnchorRef[], lines: [start, end] });
    });
    concepts.push({ id: data.concept, kind: data.kind, name: data.name, entries: data.entries ?? [], file, claims });
  }
  return { concepts, errors };
}
