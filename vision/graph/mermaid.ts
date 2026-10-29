import type { SystemModel } from "../model/types.js";

export function toMermaid(model: SystemModel): string {
  const lines = ["flowchart TD"];
  const ids = new Map<string, string>();
  let counter = 0;

  function idFor(key: string): string {
    let id = ids.get(key);
    if (!id) {
      id = `n${counter++}`;
      ids.set(key, id);
    }
    return id;
  }

  for (const file of model.files) {
    lines.push(`    ${idFor(file.path)}["${file.path}"]`);
  }

  const externalDeclared = new Set<string>();
  const edgesDrawn = new Set<string>();
  for (const dep of model.dependencies) {
    const fromId = idFor(dep.from);
    if (dep.external && !externalDeclared.has(dep.to)) {
      lines.push(`    ${idFor(dep.to)}(["${dep.to}"])`);
      externalDeclared.add(dep.to);
    }
    // Deux instructions d'import distinctes (ex. une valeur, un `import
    // type`) vers le même fichier produisent deux DependencyFact identiques
    // en from/to — corrects comme faits, mais une arête dupliquée dans le
    // graphe n'apporte rien au lecteur. On dédoublonne ici, au rendu
    // uniquement — le modèle sous-jacent garde les deux faits (cas trouvé en
    // scannant examples/reference-project).
    const edgeKey = `${dep.from}->${dep.to}`;
    if (edgesDrawn.has(edgeKey)) continue;
    edgesDrawn.add(edgeKey);
    lines.push(`    ${fromId} --> ${idFor(dep.to)}`);
  }

  return lines.join("\n") + "\n";
}
