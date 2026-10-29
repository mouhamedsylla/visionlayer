import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { collectionOf } from "./firestore-path.js";

/**
 * Les règles de sécurité Firestore (https://firebase.google.com/docs/firestore/security/rules-structure) :
 * chaque `match /col/{id}`, imbriqué ou non, est une collection et la ligne
 * de sa règle d'accès.
 *
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /users/{uid} {                 → users, ligne 3
 *         match /wallet/{doc} { … }          → users/{}/wallet, ligne 4
 *
 * entity_rule(Fichier, firestore, Collection, Ligne)
 *
 * Un joker récursif (`{document=**}`) couvre tout un sous-arbre : il ne nomme
 * aucune collection.
 */
const script: PackScript = ({ file, fact }) => {
  if (!/service\s+cloud\.firestore/.test(file.source)) return [];
  const out: FileFact[] = [];
  const stack: { depth: number; segs: string[] }[] = [];
  let depth = 0;
  file.source.split("\n").forEach((raw, i) => {
    const text = raw.replace(/\/\/.*$/, "");
    // Le chemin a ses propres accolades : seule la dernière ouvre le bloc.
    const m = text.match(/match\s+(\/\S+?)\s*\{\s*$/);
    if (m) {
      while (stack.length && stack[stack.length - 1]!.depth >= depth) stack.pop();
      const parent = stack[stack.length - 1]?.segs ?? [];
      const segs = m[1]!.split("/").filter(Boolean).map((s) => (s.startsWith("{") ? (s.includes("=**") ? "**" : "{}") : s));
      const full = [...parent, ...segs];
      stack.push({ depth, segs: full });
      const clean = full.filter((s, k) => !(k < 3 && (s === "databases" || (k === 1 && s === "{}") || s === "documents")));
      if (!clean.includes("**") && clean.length % 2 === 0) {
        const col = collectionOf(clean);
        if (col) out.push(fact("entity_rule", [file.path, "firestore", col, i + 1], i + 1));
      }
    }
    for (const ch of text) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
  });
  return out;
};
export default script;
