import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Règles de la nouvelle interface (recodée depuis les maquettes, 02/10) :
 * rien n'est repris de l'ancienne, archivée dans archive/ui-v1 ; des fichiers
 * courts, chacun une responsabilité ; les couleurs viennent du thème seul.
 */

const SRC = join(import.meta.dirname, "../ui/src");
const MAX_LINES = 150;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const all = files(SRC);
const rel = (f: string) => relative(SRC, f);

test("ui : rien n'est importé de l'archive de l'ancienne interface", () => {
  const bad = all.filter((f) => /archive|ui-v1/.test(readFileSync(f, "utf8").match(/from\s+["'][^"']+["']/g)?.join(" ") ?? ""));
  assert.deepEqual(bad.map(rel), []);
});

test(`ui : aucun fichier ne dépasse ${MAX_LINES} lignes`, () => {
  const long = all.filter((f) => readFileSync(f, "utf8").split("\n").length > MAX_LINES);
  assert.deepEqual(long.map(rel), []);
});

test("ui : aucune couleur écrite en dur hors du thème", () => {
  const bad = all
    .filter((f) => !f.endsWith(join("theme", "tokens.css")))
    .filter((f) => /#[0-9a-fA-F]{3,8}\b(?![^"]*\])|rgba?\(/.test(readFileSync(f, "utf8").replace(/url\(#[^)]+\)/g, "")));
  assert.deepEqual(bad.map(rel), []);
});

test("ui : une feuille de style par composant, jamais une feuille globale partagée", () => {
  const globalCss = all.filter((f) => f.endsWith(".css") && !f.endsWith(".module.css") && !f.includes(`${join("src", "theme")}`));
  assert.deepEqual(globalCss.map(rel), []);
});
