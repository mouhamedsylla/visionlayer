#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { FactBase } from "../vision/facts/base.js";
import { loadPacks } from "../vision/facts/packs.js";
import { PackRegistry } from "../vision/facts/registry.js";
import { packBrief } from "../vision/writer/brief.js";
import { writePack, MODEL } from "../vision/writer/spark.js";
import { loadProposal } from "../vision/writer/load.js";
import { cliArgs } from "../vision/cli/args.js";
import { parse as parseYaml } from "yaml";

/**
 * vision pack write <paquet> [chemin] [--doc fichier]   la fiche, puis Muse Spark écrit le pack ; il est déposé
 *                                                        dans .vision/packs/proposes/ et essayé à part sur le projet
 * vision pack fiche <paquet> [chemin] [--doc fichier]   la fiche seule, pour un autre assistant
 * vision pack retire <id> [chemin]                       retire un pack chargé ; la carte redevient celle d'avant
 * vision pack accept <id> [chemin]                       charge un pack resté proposé
 * vision pack reject <id> [chemin]                       retire un pack proposé
 *
 * VisionLayer n'écrit que dans .vision/, et seulement sur ce geste (ADR 0019).
 */
const args = cliArgs();
const docAt = args.indexOf("--doc");
const docArg = docAt >= 0 ? args[docAt + 1] : undefined;
const [verb, name, path] = args.filter((a, i) => !a.startsWith("--") && (docAt < 0 || i !== docAt + 1));
const root = resolve(path ?? ".");
const proposes = join(root, ".vision", "packs", "proposes");
if (!verb || !name || !existsSync(root)) {
  console.error("usage: vision pack write|fiche <paquet> [chemin] [--doc fichier] | accept|reject <id> [chemin]");
  process.exit(1);
}

if (verb === "retire") {
  const { retirePack } = await import("../vision/writer/load.js");
  retirePack(root, name);
  console.log(`${name} retiré : rangé dans .vision/packs/retires/, la carte redevient celle d'avant.`);
  process.exit(0);
}

if (verb === "accept" || verb === "reject") {
  const from = join(proposes, `${name}.yaml`);
  if (!existsSync(from)) { console.error(`aucun pack proposé ${name} dans ${proposes}`); process.exit(1); }
  if (verb === "accept") {
    renameSync(from, join(root, ".vision", "packs", `${name}.yaml`));
    console.log(`${name} accepté : il est dans .vision/packs/, la carte le prend au prochain rafraîchissement.`);
  } else {
    for (const ext of [".yaml", ".md", ".changes.json", ".steps.json"]) rmSync(join(proposes, name + ext), { force: true });
    console.log(`${name} refusé et retiré ; la carte reste celle d'avant.`);
  }
  process.exit(0);
}

const builtins = await loadPacks();
const example = readFileSync(join(import.meta.dirname, "..", "vision", "writer", "example-pack.yaml"), "utf8");
const brief = packBrief({ root, pkg: name, builtins, example, ...(docArg ? { docs: [{ source: docArg, text: readFileSync(docArg, "utf8") }] } : {}) });
mkdirSync(proposes, { recursive: true });
const id = name.replace(/^@/, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
writeFileSync(join(proposes, `${id}.fiche.md`), brief.text);
console.log(`Fiche écrite : ${join(proposes, `${id}.fiche.md`)} (documentation : ${brief.sources.join(", ") || "aucune"})`);
if (verb === "fiche") process.exit(0);

console.log(`${MODEL} écrit le pack…`);
const result = await writePack(brief, builtins, {
  onStep: (s) => console.log(`  [${s.turn}] ${s.tool}${s.tool === "check_pack" || s.tool === "submit_pack" ? ` → ${s.output.split("\n")[0]}` : ""}`),
});
const u = result.usage;
console.log(`${u.turns} échanges, ${u.input} tokens lus, ${u.output} écrits, ${u.cost.toFixed(3)} $, ${u.seconds} s`);
if (!result.yaml) {
  writeFileSync(join(proposes, `${id}.steps.json`), JSON.stringify(result, null, 2));
  console.error(`Pas de pack rendu.${result.said ? ` Dernier message : ${result.said}` : ""}`);
  process.exit(1);
}

// Le pack rendu garde son identifiant ; c'est sous ce nom qu'il est proposé.
const packId = result.yaml.match(/^id:\s*([a-z0-9-]+)/m)?.[1] ?? id;
writeFileSync(join(proposes, `${packId}.yaml`), result.yaml);
writeFileSync(join(proposes, `${packId}.md`), result.doc ?? "");
writeFileSync(join(proposes, `${packId}.steps.json`), JSON.stringify({ usage: u, steps: result.steps }, null, 2));

// L'aperçu, dans un domaine à part : la carte acceptée n'est pas touchée.
const registry = new PackRegistry(root, builtins);
let base = new FactBase(root, builtins);
base.refresh();
base = await registry.sync(base);
const preview = await registry.preview(base, result.yaml, `${packId}.yaml`);
writeFileSync(join(proposes, `${packId}.changes.json`), JSON.stringify(preview, null, 2));
console.log(`\nPack proposé : ${join(proposes, `${packId}.yaml`)} (${preview.state.status}${preview.state.reason ? ` : ${preview.state.reason}` : ""})`);
console.log(preview.changes.length ? "Ce qu'il change sur la carte de ce projet :" : "Il ne change rien sur la carte de ce projet.");
for (const c of preview.changes) console.log(`  ${c.sign === "added" ? "+" : "-"} ${c.text}${c.proof ? `  (${c.proof.path}:${c.proof.line})` : ""}`);
// Chargement seul (ADR 0019, étape 6) : un pack qui passe toutes ses vérifications quitte les propositions.
if (preview.state.status === "failed") {
  console.error(`Pas chargé : ${preview.state.reason ?? "une vérification échoue"}. La technologie reste non lue.`);
  process.exit(2);
}
const tests = ((parseYaml(result.yaml) as { tests?: unknown[] } | null)?.tests ?? []).length;
loadProposal(root, packId, { by: "muse", pkg: name, at: new Date().toISOString(), tests, cost: u.cost });
console.log(`\nChargé seul : ${packId} est dans .vision/packs/. Le retirer : pnpm packs retire ${packId} ${root}`);
