import { techsForPackage } from "../stack/catalog.js";
import { selectDocs } from "./published-docs.js";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Pack } from "../facts/packs.js";
import { vocabularyText } from "./vocabulary.js";

/**
 * La fiche qui fait écrire un pack par un agent (ADR 0019 §1) : technologie → inventaire → tests → pack.
 *
 * VisionLayer ne lance pas d'agent pour écrire un pack à sa place ; il prépare la fiche, que suit l'assistant
 * Muse (vision/writer/spark.ts) ou tout autre assistant qui a les mêmes outils. La fiche ne contient rien du
 * projet ouvert, sauf la version de la technologie lue dans son manifeste : c'est la garde principale. Un
 * agent qui voit le projet voudrait faire passer ce projet-là, et taillerait le pack pour lui.
 */
export interface Brief {
  pkg: string;
  version?: string;
  /** Les sources de la documentation, pour dire d'où vient ce que l'agent a lu. */
  sources: string[];
  text: string;
}

export interface BriefInput {
  /** Le projet ouvert : seulement pour la version et la documentation installée dans node_modules. */
  root: string;
  pkg: string;
  /** Une documentation fournie par l'utilisateur (un fichier), quand node_modules n'en a pas. */
  docs?: { source: string; text: string }[];
  builtins: Pack[];
  /** Un pack local accepté, montré comme exemple. */
  example: string;
  /** Les autres paquets de la même technologie que le projet déclare : le pack doit les couvrir aussi. */
  also?: string[];
  /** Une capture : la question posée au code (planche L5). Le pack ne lit alors que ce qui y répond. */
  question?: string;
}

/** Les autres paquets de la même technologie que le projet déclare : `@aws-sdk/client-s3` et `@aws-sdk/lib-storage`. Le manifeste seul, jamais le code. */
export function siblingPackages(root: string, pkg: string): string[] {
  const techs = new Set(techsForPackage("npm", pkg).map((t) => t.id));
  if (!techs.size) return [];
  try {
    const m = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { dependencies?: Record<string, string> };
    return Object.keys(m.dependencies ?? {}).filter((d) => d !== pkg && techsForPackage("npm", d).some((t) => techs.has(t.id)));
  } catch {
    return [];
  }
}

/** La documentation qu'on trouve dans node_modules ; vide : le paquet n'est pas installé. */
export function hasInstalledDocs(root: string, pkg: string): boolean {
  return installedDocs(root, pkg).length > 0;
}

/** Au-delà, une documentation est coupée : un .d.ts généré peut faire des mégaoctets. */
const DOC_LIMIT = 60_000;

export function packBrief(input: BriefInput): Brief {
  const { root, pkg } = input;
  const version = versionOf(root, pkg);
  const docs = [...installedDocs(root, pkg), ...(input.docs ?? [])];
  const id = pkg.replace(/^@/, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const prefix = id.replace(/-/g, "_");

  const text = `# Fiche : écrire le pack de \`${pkg}\`${version ? ` (version ${version})` : ""}

Tu écris un pack pour VisionLayer, un lecteur statique de code qui dessine la carte d'un système : ses programmes, leurs portes d'entrée, leurs données, leurs liens, et comment un appelant prouve qui il est. Un pack dit ce que veut dire une technologie, comme des données : des motifs de l'arbre syntaxique qui émettent des faits, et des règles qui les joignent.

${input.question ? `## La question : ce pack est une capture

Quelqu'un a posé cette question sur des projets qui emploient \`${pkg}\` : « ${input.question} ».

Tu n'écris pas l'inventaire de toute la technologie : seulement les formes qui répondent à cette question, avec un test par forme. Et ta capture doit remplir une représentation que la carte sait dessiner, avec le vocabulaire plus bas. Quand la question porte sur l'injection (qui reçoit quoi d'un conteneur), c'est le contrat (X3) : produis \`binds\` là où le framework branche une classe sur un contrat, et \`receives\` là où une classe le reçoit. Un contrat est une interface ou une classe abstraite du dépôt. Si aucune relation du vocabulaire ne permet de répondre, dis-le dans ta page de documentation plutôt que d'inventer.

` : ""}## Ce qui compte

- **La technologie, jamais un projet.** Tu ne vois aucun projet, et c'est voulu. Tout vient de la documentation ci-dessous. N'invente aucune API qu'elle ne montre pas.
- **Ce que la carte sait montrer.** Un pack qui décrit des appels de fonctions ne change rien. Demande-toi ce que la technologie change au programme qui l'emploie : une porte d'entrée, une lecture de données, un appel sortant, une façon de reconnaître l'appelant. Puis exprime-le avec le vocabulaire plus bas.
- **Installé n'est pas employé.** Monter ou configurer la technologie ne dit pas ce que le code fait de ce qu'elle fournit. Un fait se fonde sur la ligne qui emploie vraiment ce qu'elle apporte. Écris aussi le test où elle est montée mais ce qu'elle fournit n'est jamais lu, ou lu autrement que la documentation le demande.
- **Rien d'inventé, rien de tu.** Ce qu'un lecteur statique ne peut pas trancher (un nom calculé à l'exécution, passé en paramètre) n'est jamais deviné, mais l'opération reste vraie : émets l'appel sortant et l'emploi du service avec ce qui est écrit, et \`unresolved($file, path_dynamic, $line)\` à la place du nom. Une carte qui se tait sur un appel réel ment autant qu'une carte qui invente.
- **Le code réel enveloppe la bibliothèque.** La documentation montre \`const client = new X()\` puis \`client.index("films")\`. Un projet range souvent le client dans un champ de classe (\`this.client = new X()\`), reçoit le nom en paramètre (\`index(name)\`), obtient l'objet par une fonction (\`const index = await this.getIndex(name)\`). Ne fais pas dépendre un fait d'une chaîne de variables qu'un tel code casse : une méthode propre à la technologie (\`addDocuments\`, \`search\`) appelée dans un fichier qui l'importe suffit à fonder l'appel. Écris un test pour chacune de ces formes.
- **Un framework qui charge des fichiers par convention.** Un point d'entrée n'apparaît sur la carte que si son fichier appartient à un programme lancé. Quand la technologie fait elle-même tourner l'application (un framework qui sert des pages et des routes rangées par dossiers), déclare ce programme : \`unit\` (sur le manifeste du paquet, \`package.json\`), \`unit_runs\` vers le fichier par lequel il démarre (la mise en page racine, la configuration), \`unit_tech\`, puis \`loads\` de ce fichier vers chaque page et chaque route. La clé d'une route HTTP s'écrit \`VERBE /chemin\` (\`GET /orders/:id\`) ; une page est un \`GET\`.
- **Pas de script.** Un pack écrit par un agent n'a droit qu'à des requêtes et des règles.

## La marche à suivre

1. **L'inventaire** : chaque forme de l'API documentée qui change ce que fait un programme, avec un exemple de code tel qu'un projet l'écrirait.
2. **Un test par forme** : un petit dépôt de un ou deux fichiers, les faits attendus, et au moins un test des faux amis (le même nom de méthode sur un objet qui ne vient pas de \`${pkg}\`), avec les faits qui ne doivent pas sortir.
3. **Le pack**. Avant d'écrire une requête, appelle \`syntax_tree\` sur l'exemple : il rend l'arbre exact que voit tree-sitter. Une requête écrite de mémoire se trompe souvent de nom de nœud.
4. **\`check_pack\`** jusqu'à ce que tout passe. Il vérifie le schéma, ce que le pack déclare, puis lance chaque test à part avec les packs livrés, et te rend pour chaque test ce qui manque, ce qui sort à tort, et tous les faits produits.
5. **\`submit_pack\`** avec le pack et sa page de documentation en français : le tableau des formes (numéro, forme, exemple, état : lu ou non lu, et pourquoi).

## Le format d'un pack

\`\`\`yaml
id: ${id}                       # minuscules, chiffres, tirets ; ce ne peut pas être celui d'un pack livré
name: ${pkg}
languages: [javascript, typescript]
when: { imports: [${pkg}] }     # facultatif : le pack ne s'ouvre que dans les fichiers qui importent ce paquet
provides: [${prefix}_form1]   # TOUTES les relations qu'il produit, émissions et têtes de règles, neutres comprises
requires: []                    # les relations d'autres packs qu'il lit (entrypoint, handler_at…), s'il en lit
match:
  - id: forme-1
    query: |                    # une requête tree-sitter, syntaxe standard ; pas de prédicats #eq? ni #match? : filtre dans where
      (call_expression function: (identifier) @fn arguments: (arguments) @args) @call
    where:                      # filtres sur les captures, évalués par VisionLayer
      fn: { import_of: ${pkg} }
    at: call                    # la capture dont la ligne prouve le fait
    emit: ${prefix}_form1($file, @fn, $line)
rules: |
  % une règle Datalog par ligne ; % commente. Ici, une relation neutre du vocabulaire, déduite de la forme :
  % relation_neutre(F, …, L) :- ${prefix}_form1(F, _, L).
tests:
  - name: F1 la forme documentée
    files:
      app.ts: |
        import x from "${pkg}";
        …
    expect: ['${prefix}_form1("app.ts", "x", _)']   # _ vaut n'importe quoi
    absent: []
\`\`\`

Sans \`when\`, le pack s'ouvre dans tous les fichiers JavaScript et TypeScript : c'est utile quand la forme à lire est écrite dans un fichier qui n'importe pas le paquet (une valeur que le paquet a posée sur un objet, lue plus loin). Les règles sont globales : elles joignent les faits de tous les fichiers.

### \`where\`

| Forme | Vrai si la capture… |
|---|---|
| \`[a, b]\` ou \`{ any: [a, b] }\` | vaut \`a\` ou \`b\` |
| \`{ not: [a, b] }\` | ne vaut ni \`a\` ni \`b\` |
| \`{ match: "^[A-Z_]+$" }\` | correspond à l'expression |
| \`{ import_of: paquet }\` | est un nom importé de ce paquet (\`import cp from "${pkg}"\`, \`const cp = require("${pkg}")\`) |
| \`{ bound_to: paquet }\` | est une variable créée par un appel à ce que fournit le paquet : \`const app = express()\` |

La valeur d'une capture est celle d'une chaîne littérale si c'en est une, sinon le texte du code.

### \`emit\`

Une émission ou une liste, \`relation(arg, …)\`. Une émission dont un argument manque ne produit rien.

| Argument | Valeur |
|---|---|
| \`$file\`, \`$line\` | le fichier, la ligne de la preuve |
| \`@nom\` | la valeur de la capture |
| \`@nom:raw\`, \`@nom:upper\`, \`@nom:lower\` | son texte brut, en majuscules, en minuscules |
| \`@nom:symbol\`, \`@nom:line\` | le nom de la fonction appelée (enveloppes retirées), sa ligne |
| \`@nom:pkg\` | le paquet d'où vient ce nom importé |
| \`"texte {nom}"\` | un gabarit |
| \`mot\`, \`"chaîne"\`, \`42\` | une constante |

### \`rules\`

- Une variable commence par une majuscule ou \`_\` ; \`_\` seul ne lie rien.
- Une constante : une chaîne entre guillemets, un nombre, un mot en minuscules.
- \`not r(…)\` : négation ; ses variables doivent être liées ailleurs dans le corps.
- \`X != Y\`, \`X = Y\`, \`L1 < L2\` : comparaisons ; \`P = cat(A, "/", B)\` colle des chaînes.

## Le vocabulaire de faits

${vocabularyText(input.builtins)}

## Un pack local accepté, en exemple

\`\`\`yaml
${input.example.trim()}
\`\`\`

## La documentation de \`${pkg}\`${input.also?.length ? `

Cette technologie passe aussi par ${input.also.map((a) => `\`${a}\``).join(", ")} : leur documentation est ci-dessous. Un projet peut n'employer que l'un de ces paquets : couvre-les tous, dans \`when.imports\` et dans tes formes.` : ""}

${docs.length ? docs.map((d) => `### ${d.source}\n\n${d.text.length > DOC_LIMIT ? `${d.text.slice(0, DOC_LIMIT)}\n\n[… coupé à ${DOC_LIMIT} caractères]` : d.text}`).join("\n\n") : "Aucune documentation trouvée : ni dans node_modules, ni publiée sur npm, ni fournie. N'écris rien que tu ne puisses fonder ; rends un pack vide plutôt qu'un pack deviné."}
`;
  return { pkg, ...(version ? { version } : {}), sources: docs.map((d) => d.source), text };
}

/** La version déclarée par le projet : la seule chose que la fiche lui prend. */
export function versionOf(root: string, pkg: string): string | undefined {
  try {
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    return manifest.dependencies?.[pkg] ?? manifest.devDependencies?.[pkg];
  } catch {
    return undefined;
  }
}

/**
 * Le README et les types du paquet et de @types, s'ils sont installés : dans le node_modules de la racine, ou
 * dans celui d'un paquet du dépôt (un monorepo installe souvent une bibliothèque dans le paquet qui l'emploie).
 * Les types sont ceux que nomme le champ `types` du paquet, sinon les .d.ts posés à sa racine.
 */
export function installedDocs(root: string, pkg: string): { source: string; text: string }[] {
  const out: { source: string; text: string }[] = [];
  const typesName = `@types/${pkg.startsWith("@") ? pkg.slice(1).replace("/", "__") : pkg}`;
  for (const name of [pkg, typesName]) {
    const base = packageDirs(root).map((d) => join(d, "node_modules", name)).find((d) => existsSync(d));
    if (!base) continue;
    const rel = relative(root, base);
    for (const f of readdirSync(base).sort()) {
      const path = join(base, f);
      if (!statSync(path).isFile()) continue;
      if (/^readme(\.md)?$/i.test(f) || f.endsWith(".d.ts")) out.push({ source: `${rel}/${f}`, text: readFileSync(path, "utf8") });
    }
    // Le dossier docs/ du paquet : c'est souvent là qu'est décrite l'API (le README ne fait que la présenter).
    for (const d of ["docs", "doc"]) if (existsSync(join(base, d))) {
      const pages = readdirSync(join(base, d), { recursive: true, encoding: "utf8" }).filter((f) => /\.mdx?$/i.test(f)).map((f) => ({ path: `${d}/${f}`, text: readFileSync(join(base, d, f), "utf8") }));
      out.push(...selectDocs(pages, (p) => `${rel}/${p}`));
    }
    try {
      const manifest = JSON.parse(readFileSync(join(base, "package.json"), "utf8")) as { types?: string; typings?: string };
      const types = manifest.types ?? manifest.typings;
      const path = types ? join(base, types) : undefined;
      if (path && existsSync(path) && !out.some((o) => o.source === `${rel}/${types}`)) out.push({ source: `${rel}/${types!.replace(/^\.\//, "")}`, text: readFileSync(path, "utf8") });
    } catch { /* pas de manifeste lisible : le README suffit */ }
  }
  return out;
}

/** La racine, puis les dossiers des paquets du dépôt (ceux qui ont un package.json), hors node_modules. */
function packageDirs(root: string): string[] {
  const out = [root];
  const walk = (dir: string, depth: number) => {
    if (depth > 3) return;
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      if (!f.isDirectory() || f.name === "node_modules" || f.name.startsWith(".")) continue;
      const d = join(dir, f.name);
      if (existsSync(join(d, "package.json"))) out.push(d);
      walk(d, depth + 1);
    }
  };
  walk(root, 0);
  return out;
}
