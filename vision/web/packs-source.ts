import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { loadPacks } from "../facts/packs.js";
import type { PackProposal, PacksPayload, WriterJob } from "./types.js";

/**
 * Les packs d'un dépôt, pour l'écran Packs (planche 02) : les packs livrés, ceux du projet, les propositions
 * de l'écrivain (.vision/packs/proposes/) avec tout ce qu'il a déposé, et les deux gestes humains qui
 * décident (ADR 0019) : accepter, refuser. Lancer l'écrivain est aussi un geste humain ; il tourne à part
 * et dépose une proposition, sans rien charger.
 */
export class PacksSource {
  private job?: WriterJob;

  constructor(private readonly root: string) {}

  private get proposes() { return join(this.root, ".vision", "packs", "proposes"); }

  async get(used: string[]): Promise<PacksPayload> {
    const builtins = (await loadPacks()).filter((p) => p.id !== "core").map((p) => ({ id: p.id, name: p.name, tech: p.tech, used: used.includes(p.id) }));
    const local = existsSync(join(this.root, ".vision", "packs"))
      ? readdirSync(join(this.root, ".vision", "packs")).filter((f) => f.endsWith(".yaml")).map((f) => f.replace(/\.yaml$/, "")).sort() : [];
    const proposals = existsSync(this.proposes)
      ? readdirSync(this.proposes).filter((f) => f.endsWith(".yaml")).map((f) => this.proposal(f.replace(/\.yaml$/, ""))).filter((p): p is PackProposal => !!p) : [];
    return { builtins, local, proposals, ...(this.job ? { job: this.job } : {}) };
  }

  /** Tout ce que l'écrivain a déposé pour une proposition : le pack, sa page, sa fiche, la différence prévue, son coût. */
  private proposal(id: string): PackProposal | undefined {
    const read = (ext: string) => { const f = join(this.proposes, `${id}${ext}`); return existsSync(f) ? readFileSync(f, "utf8") : undefined; };
    const yaml = read(".yaml");
    if (!yaml) return undefined;
    let parsed: { name?: string; provides?: string[]; rules?: string; tests?: { name: string }[]; match?: unknown[] } = {};
    try { parsed = parseYaml(yaml) ?? {}; } catch { /* un pack illisible reste montré tel quel */ }
    const preview = read(".changes.json");
    const steps = read(".steps.json");
    const fiche = [...readdirSync(this.proposes)].find((f) => f.endsWith(".fiche.md") && (f === `${id}.fiche.md` || readFileSync(join(this.proposes, f), "utf8").includes(`\`${parsed.name ?? id}\``)));
    return {
      id, name: parsed.name ?? id, yaml, doc: read(".md") ?? "",
      fiche: fiche ? readFileSync(join(this.proposes, fiche), "utf8") : "",
      provides: parsed.provides ?? [],
      rules: (parsed.rules ?? "").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("%") && !l.startsWith("#")),
      tests: (parsed.tests ?? []).map((t) => t.name),
      matches: parsed.match?.length ?? 0,
      ...(preview ? { preview: JSON.parse(preview) } : {}),
      ...(steps ? { usage: JSON.parse(steps).usage } : {}),
    };
  }

  /** L'accord humain : le pack passe dans .vision/packs/, la carte le prend au prochain calcul. */
  accept(id: string): void {
    const from = join(this.proposes, `${id}.yaml`);
    if (!/^[a-z0-9-]+$/.test(id) || !existsSync(from)) throw new Error(`aucun pack proposé ${id}`);
    renameSync(from, join(this.root, ".vision", "packs", `${id}.yaml`));
  }

  /** Le refus : la proposition et ce qui l'accompagne sont retirés ; la carte reste celle d'avant. */
  reject(id: string): void {
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`identifiant refusé : ${id}`);
    for (const ext of [".yaml", ".md", ".changes.json", ".steps.json", ".fiche.md"]) rmSync(join(this.proposes, id + ext), { force: true });
  }

  /** Lancer l'écrivain sur une technologie : Muse Spark lit sa documentation, jamais le projet, et dépose une proposition. */
  write(pkg: string): WriterJob {
    if (this.job && !this.job.done) throw new Error(`l'écrivain travaille déjà sur ${this.job.pkg}`);
    if (!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(pkg)) throw new Error(`nom de paquet refusé : ${pkg}`);
    const job: WriterJob = { pkg, lines: [], done: false, started: new Date().toISOString() };
    this.job = job;
    const cli = join(import.meta.dirname, "..", "..", "cli", "pack.ts");
    const child = spawn(process.execPath, ["--import", "tsx", cli, "write", pkg, this.root], { cwd: join(import.meta.dirname, "..", ".."), env: process.env });
    const take = (b: Buffer) => { for (const l of b.toString().split("\n")) if (l.trim()) job.lines.push(l); };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    child.on("close", (code) => { job.done = true; job.ok = code === 0; });
    return job;
  }
}
