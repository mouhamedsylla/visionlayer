#!/usr/bin/env node
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { scanRepository } from "../vision/model/scan.js";
import { cliArgs } from "../vision/cli/args.js";

const targetArg = cliArgs()[0];
const target = resolve(targetArg ?? ".");

if (!existsSync(target)) {
  console.error(`usage: vision update [chemin]\nLe chemin "${target}" n'existe pas.`);
  process.exit(1);
}

const { model, commit } = scanRepository(target, { archive: true });

console.log(`Modèle mis à jour : ${model.files.length} fichier(s), ${model.dependencies.length} dépendance(s).`);
console.log(commit ? `Commit courant: ${commit}` : "Pas de dépôt Git détecté — commit non enregistré.");
console.log(`Comparez avec l'état précédent via: vision diff ${targetArg ?? "."}`);
