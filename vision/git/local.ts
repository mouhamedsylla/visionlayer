import { execFileSync } from "node:child_process";

/**
 * Lecture Git strictement locale (ADR 0006) — jamais de remote, jamais de
 * token. `execFileSync` avec un tableau d'arguments fixe, jamais une chaîne
 * shell interpolée.
 */
export function currentCommit(root: string): string | undefined {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
}

/** Branche courante, ou undefined (HEAD détaché, hors git). */
export function currentBranch(root: string): string | undefined {
  try {
    const b = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return b && b !== "HEAD" ? b : undefined;
  } catch {
    return undefined;
  }
}

/** Message (première ligne) et date du commit courant, ou undefined hors git. */
export function lastCommit(root: string): { subject: string; date: string } | undefined {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI%x09%s"], { cwd: root, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const tab = out.indexOf("\t");
    return tab > 0 ? { date: out.slice(0, tab), subject: out.slice(tab + 1) } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Le dernier commit qui a touché ce dossier (hash court et première ligne) :
 * dans un dépôt qui en contient plusieurs, celui de HEAD peut parler d'autre chose.
 */
export function lastCommitIn(root: string): { commit: string; subject: string } | undefined {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%h%x09%s", "--", "."], { cwd: root, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const tab = out.indexOf("\t");
    return tab > 0 ? { commit: out.slice(0, tab), subject: out.slice(tab + 1) } : undefined;
  } catch {
    return undefined;
  }
}

/** Les derniers commits (hash court, date, première ligne du message), du plus récent au plus ancien. */
export function recentCommits(root: string, count = 5): { hash: string; date: string; subject: string }[] {
  try {
    const out = execFileSync("git", ["log", `-${Math.max(1, Math.min(50, count))}`, "--format=%h%x09%cI%x09%s"], { cwd: root, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
    return out.split("\n").filter(Boolean).map((l) => {
      const [hash, date, ...rest] = l.split("\t");
      return { hash: hash!, date: date!, subject: rest.join("\t") };
    });
  } catch {
    return [];
  }
}
