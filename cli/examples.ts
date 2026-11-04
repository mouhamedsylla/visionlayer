import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

/** Les projets d'exemple : clonés à un commit fixé, seulement lus. Seul le jeu d'un Replay exécute du code, et il le demande. */
const PUBLIC = [
  { dir: "barbershop", name: "Barbershop Booking System", note: "Express, Prisma, Stripe, node-cron. Projet public jamais vu, lu sans retouche.", repo: "https://github.com/MrTabaOfficial/Barbershop-Booking-System", commit: "f1139afd1711e6fceb13dd876a308c940b10f33d" },
  { dir: "lingua-crm", name: "Lingua CRM", note: "Express, Prisma, BullMQ. Projet public jamais vu, lu sans retouche.", repo: "https://github.com/sergei-cmyk-web/lingua-crm", commit: "d54e02062a60f0ef96dbf5c774b31408523650f8" },
  { dir: "mini-erp-crm", name: "Mini ERP CRM", note: "Express, Prisma. Une vraie session d'agent et son Replay.", repo: "https://github.com/Rahul03ll/mini-erp-crm", commit: "ff54f1a1f48642d7cf47a55e96c795231a30a525" },
];

/** Prépare le dossier des exemples ; ce qui est déjà là n'est pas refait. Rend son chemin. */
export function prepareExamples(repoRoot: string, dir = join(homedir(), ".visionlayer", "examples")): string {
  mkdirSync(dir, { recursive: true });
  const atelier = join(dir, "atelier-api");
  if (!existsSync(atelier)) {
    cpSync(join(repoRoot, "tests", "corpus", "atelier-api"), atelier, { recursive: true });
    writeFileSync(join(atelier, "demo.json"), JSON.stringify({ name: "Atelier API", note: "Express, Drizzle, Stripe, BullMQ, node-cron. Notre application d'essai : le moteur a été réglé dessus." }));
  }
  for (const p of PUBLIC) {
    const to = join(dir, p.dir);
    if (existsSync(to)) continue;
    console.log(`Clone de ${p.repo}…`);
    execFileSync("git", ["clone", "--quiet", p.repo, to], { stdio: "inherit" });
    execFileSync("git", ["checkout", "--quiet", p.commit], { cwd: to, stdio: "inherit" });
    writeFileSync(join(to, "demo.json"), JSON.stringify({ name: p.name, note: p.note }));
    const bundle = join(repoRoot, "examples", p.dir, "session");
    if (existsSync(bundle)) {
      cpSync(bundle, join(to, ".vision"), { recursive: true });
      // L'état que la session a laissé : son correctif et son test.
      const patch = join(to, ".vision", "replays", "r-001.patch");
      if (existsSync(patch)) execFileSync("git", ["apply", patch], { cwd: to, stdio: "inherit" });
      const tests = join(to, ".vision", "replays", "r-001.tests");
      if (existsSync(tests)) cpSync(tests, to, { recursive: true });
    }
  }
  return dir;
}
