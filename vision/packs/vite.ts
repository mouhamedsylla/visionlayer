import { posix } from "node:path";
import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { literal, unwrap, walkAll } from "../arch/ast.js";
import { dirOf } from "./runs.js";

/**
 * vite_root(Fichier, Dossier)   la racine de l'app : le dossier de la configuration, ou son option `root`,
 *                               lue depuis ce dossier ou depuis la racine du dépôt (d'où Vite peut être lancé)
 */
const script: PackScript = ({ file, root, fact }) => {
  const dir = dirOf(file.path);
  let rootOpt: string | undefined;
  let line = 1;
  if (root) walkAll(root, (n) => {
    if (rootOpt !== undefined || n.type !== "pair" || n.childForFieldName("key")?.text.replace(/['"]/g, "") !== "root") return;
    // L'option de premier niveau de la configuration, pas une clé `root` imbriquée.
    if (n.parent?.parent?.type === "pair") return;
    const v = literal(unwrap(n.childForFieldName("value")));
    if (v !== undefined) { rootOpt = v; line = n.startPosition.row + 1; }
  });
  // `root` se lit depuis le dossier d'où Vite est lancé : celui de la configuration, ou la racine du dépôt (`vite --config web/vite.config.ts`).
  const out: FileFact[] = [];
  const candidates = rootOpt === undefined ? [dir] : [posix.join(dir, rootOpt), rootOpt];
  for (const c of new Set(candidates.map((x) => posix.normalize(x.replace(/^\.\/?/, "") || ".").replace(/^\.$/, "")))) {
    if (!c.startsWith("..") && !c.startsWith("/")) out.push(fact("vite_root", [file.path, c], line));
  }
  return out;
};
export default script;
