import { posix } from "node:path";
import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { dirOf, runTargets, sourceCandidates } from "./runs.js";

/**
 * Fly.io, d'après son inventaire (docs/fonctionnement/packs/fly.md).
 *
 * unit(Fichier, Nom, "process")              un groupe de processus ; sans groupe, l'app elle-même
 * unit_runs(Fichier, Groupe, Cible)          le fichier que lance un groupe, depuis le dossier de fly.toml
 * unit_command(Fichier, App)                 l'app a des groupes : la commande du Dockerfile n'est pas lancée telle quelle
 * unit_ctx(Fichier, App, Préfixe), unit_dockerfile(Fichier, App, Chemin)   ce qu'elle construit (lu par le pack Docker)
 * unit_instances(Fichier, Nom, N)            le minimum de machines
 * unit_env_name(Fichier, Nom, Variable)      [env], par le nom seulement
 * unit_attr(Fichier, Nom, "region", Région)  la région principale de l'app, pour chacun de ses groupes
 *
 * Lecture ligne à ligne, pour garder la ligne de chaque fait ; un tableau sur plusieurs lignes est rejoint.
 */
const script: PackScript = ({ file, fact }) => {
  const dir = dirOf(file.path);
  const out: FileFact[] = [];
  const entries: { section: string; key: string; value: string; line: number }[] = [];
  let section = "";
  let pending: { key: string; value: string; line: number } | undefined;
  file.source.split("\n").forEach((raw, i) => {
    const text = stripComment(raw).trim();
    if (pending) {
      pending.value += ` ${text}`;
      if (balanced(pending.value)) { entries.push({ section, ...pending }); pending = undefined; }
      return;
    }
    const sec = text.match(/^\[+\s*([^\]]+?)\s*\]+$/);
    if (sec) { section = sec[1]!; return; }
    const kv = text.match(/^("[^"]+"|'[^']+'|[A-Za-z0-9_.-]+)\s*=\s*(.*)$/);
    if (!kv) return;
    const e = { key: unquote(kv[1]!), value: kv[2]!, line: i + 1 };
    if (balanced(e.value)) entries.push({ section, ...e }); else pending = e;
  });

  const top = (k: string) => entries.find((e) => e.section === "" && e.key === k);
  const app = top("app") ? unquote(top("app")!.value) : "app";
  const groups = entries.filter((e) => e.section === "processes");
  const build = (k: string) => entries.find((e) => e.section === "build" && e.key === k);
  const firstLine = entries[0]?.line ?? 1;

  // Ce qu'elle construit : son Dockerfile, avec le dossier de fly.toml pour contexte.
  if (!build("image")) {
    const df = build("dockerfile") ? unquote(build("dockerfile")!.value) : "Dockerfile";
    const line = build("dockerfile")?.line ?? firstLine;
    out.push(fact("unit_ctx", [file.path, app, dir ? `${dir}/` : ""], line));
    out.push(fact("unit_dockerfile", [file.path, app, posix.normalize(posix.join(dir, df))], line));
  }
  if (groups.length) {
    out.push(fact("unit_command", [file.path, app], groups[0]!.line));
    for (const g of groups) {
      out.push(fact("unit", [file.path, g.key, "process"], g.line));
      for (const t of runTargets(unquote(g.value), dir)) for (const c of [t, ...sourceCandidates(t)]) out.push(fact("unit_runs", [file.path, g.key, c], g.line));
    }
  } else {
    out.push(fact("unit", [file.path, app, "process"], top("app")?.line ?? firstLine));
  }

  // Le minimum de machines : pour les groupes nommés par le service, sinon pour le premier groupe ou l'app.
  for (const sec of ["http_service", "services"]) {
    const min = entries.find((e) => e.section === sec && e.key === "min_machines_running");
    if (!min || !Number.isFinite(Number(min.value))) continue;
    const named = entries.find((e) => e.section === sec && e.key === "processes");
    const targets = named ? [...named.value.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]!) : [groups[0]?.key ?? app];
    for (const p of targets) out.push(fact("unit_instances", [file.path, p, Number(min.value)], min.line));
  }

  const names = groups.length ? groups.map((g) => g.key) : [app];
  const region = top("primary_region");
  if (region) for (const n of names) out.push(fact("unit_attr", [file.path, n, "region", unquote(region.value)], region.line));
  for (const e of entries.filter((x) => x.section === "env")) for (const n of names) out.push(fact("unit_env_name", [file.path, n, e.key], e.line));
  return out;
};

function stripComment(line: string): string {
  let q: string | undefined;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (q) { if (c === q) q = undefined; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === "#") return line.slice(0, i);
  }
  return line;
}

function balanced(v: string): boolean {
  return (v.match(/\[/g)?.length ?? 0) <= (v.match(/\]/g)?.length ?? 0);
}

function unquote(s: string): string { return s.trim().replace(/^["']|["']$/g, ""); }
export default script;
