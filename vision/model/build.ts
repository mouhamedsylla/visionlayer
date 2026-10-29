import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scan, languageFor } from "../scanner/scanner.js";
import { extractFile } from "../extractor/extractor.js";
import { createAliasResolver } from "./aliases.js";
import type { DependencyFact, FileFact, ReExportFact, SystemModel } from "./types.js";

export function buildModel(root: string): SystemModel {
  const snapshot = scan(root);
  const knownFiles = new Set(snapshot.files);
  const aliases = createAliasResolver(root, knownFiles);

  const files: FileFact[] = [];
  const dependencies: DependencyFact[] = [];
  const reExports: ReExportFact[] = [];

  for (const relPath of snapshot.files) {
    const language = languageFor(relPath);
    if (!language) continue;

    const source = readFileSync(join(root, relPath), "utf-8");
    const result = extractFile(relPath, source, language, knownFiles, aliases);
    files.push(result.file);
    dependencies.push(...result.dependencies);
    reExports.push(...result.reExports);
  }

  return { repository: { root }, files, dependencies, reExports };
}
