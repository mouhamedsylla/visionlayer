import { execFileSync } from "node:child_process";
import { lstatSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/** Répertoires jamais lus, même s'ils sont versionnés (artefacts, dépendances, sortie de VisionLayer). */
export const ALWAYS_IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "build", ".vision", ".next", "coverage", ".terraform", "vendor"]);

export interface ProjectFile {
  path: string;
  size: number;
}

/**
 * Fichiers du projet sous `root`, chemins relatifs triés.
 *
 * Dans un repository git : les fichiers versionnés + les nouveaux fichiers non
 * ignorés (`git ls-files -co --exclude-standard`) — ce qui est ignoré par
 * `.gitignore` n'appartient pas au projet (dossiers de travail, sorties, clés
 * locales). Hors git, ou si git ne renvoie rien (dossier lui-même ignoré), un
 * parcours du disque.
 *
 * Dans les deux cas, un lien symbolique n'est jamais suivi : un lien qui
 * pointe vers son propre dossier ferait boucler le parcours (constaté sur
 * Nafar, `ressources/ressources → .`).
 */
export function listProjectFiles(root: string): ProjectFile[] {
  const fromGit = gitFiles(root);
  const paths = fromGit && fromGit.length ? fromGit : walk(root);
  const out: ProjectFile[] = [];
  for (const path of paths) {
    if (path.split("/").some((seg) => ALWAYS_IGNORED_DIRS.has(seg))) continue;
    let stat;
    try {
      stat = lstatSync(join(root, path));
    } catch {
      continue; // supprimé du disque mais encore dans l'index
    }
    if (stat.isFile()) out.push({ path, size: stat.size });
  }
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

function gitFiles(root: string): string[] | undefined {
  try {
    const out = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
      cwd: root,
      encoding: "utf-8",
      maxBuffer: 256 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return [...new Set(out.split("\0").filter(Boolean))];
  } catch {
    return undefined;
  }
}

function walk(root: string): string[] {
  const files: string[] = [];
  const visit = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ALWAYS_IGNORED_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      let stat;
      try {
        stat = lstatSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) visit(full);
      else if (stat.isFile()) files.push(relative(root, full));
    }
  };
  visit(root);
  return files;
}
