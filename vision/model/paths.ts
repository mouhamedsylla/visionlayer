import { isAbsolute, relative, resolve } from "node:path";

/**
 * Garde défensive avant d'afficher/lire un chemin issu du modèle : refuse
 * tout chemin qui, une fois résolu contre la racine du repository, sortirait
 * de cette racine. En pratique le modèle ne contient que des chemins produits
 * par le scanner (déjà relatifs et internes), donc ce cas ne devrait jamais
 * se produire — mais `vision source`/`vision inspect` résolvent un nom fourni
 * par l'utilisateur, donc cette vérification reste le point de contrôle
 * explicite demandé par workflow/docs/mvp-roadmap.md (MVP1, point de
 * sécurité), pas une supposition.
 */
export function assertWithinRepo(root: string, relPath: string): void {
  const resolvedRoot = resolve(root);
  const resolvedPath = resolve(resolvedRoot, relPath);
  const rel = relative(resolvedRoot, resolvedPath);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`chemin hors du repository refusé: ${relPath}`);
  }
}
