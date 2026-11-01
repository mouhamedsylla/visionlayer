#!/usr/bin/env node
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MapSource } from "../../vision/web/map-source.js";
import { featureEntries } from "../../vision/web/knowledge-source.js";
import { buildKnowledge } from "../../vision/knowledge/build.js";
import { MapIndex } from "../../vision/slice/index.js";
import { buildSummary } from "../../vision/slice/summary.js";
import { workspaceLines } from "../../vision/slice/workspace.js";
import { buildSlice, formatSlice } from "../../vision/slice/build.js";
import { buildReach, changedLines, formatReach, itemKey } from "../../vision/slice/reach.js";
import { DeclarationIndex, formatSource } from "../../vision/slice/source.js";

/**
 * Serveur MCP RYPHA VisionLayer — MVP5.
 *
 * N'expose QUE des outils de lecture, tous sur la carte des packs : vision_summary,
 * vision_slice, vision_reach (la portée d'une modification en cours) et vision_source
 * (où un nom est déclaré, et qui l'appelle). Les outils de l'ancien modèle ont été
 * retirés le 01/11/2026 : ils échouaient sur tout dépôt jamais scanné à l'ancienne. `vision update`/`vision diff`/`vision report` restent
 * volontairement CLI-only, jamais exposés à un agent — mvp-roadmap.md
 * (MVP5) l'exige explicitement : la lecture peut s'automatiser sans
 * risque, l'écriture du modèle doit garder une étape humaine tant que la
 * fiabilité de VisionLayer n'est pas éprouvée (NIST AI RMF — Govern).
 */

function plainText(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

/**
 * Le dépôt lu quand l'agent ne donne pas `root` : celui d'où il a lancé le
 * serveur. `pnpm --dir <visionlayer> mcp` change le dossier courant vers
 * VisionLayer ; pnpm garde le dossier de départ dans INIT_CWD.
 */
const DEFAULT_ROOT = process.env.VISION_ROOT || process.env.INIT_CWD || process.cwd();

const server = new McpServer({ name: "rypha-vision", version: "0.1.0" });

/**
 * La carte des packs, gardée par racine pendant la vie du serveur. Chaque
 * appel la rafraîchit : seuls les fichiers modifiés depuis l'appel précédent
 * sont relus, si bien qu'un agent qui vient de modifier du code reçoit la
 * carte de ce code-là.
 */
const maps = new Map<string, MapSource>();
/** Les déclarations du dépôt, par racine, relues fichier par fichier quand un fichier change. */
const declarationIndexes = new Map<string, DeclarationIndex>();
/** Les lignes de tranche déjà données à l'agent, par racine, pour que la portée ne les répète pas (un serveur = une session d'agent). */
const sentLines = new Map<string, Set<string>>();
const sentFor = (root: string) => sentLines.get(root) ?? sentLines.set(root, new Set()).get(root)!;
async function currentMap(root: string) {
  const source = maps.get(root) ?? new MapSource(root);
  maps.set(root, source);
  const { model, localPacks } = await source.refresh();
  return { index: new MapIndex(model), knowledge: buildKnowledge(root, featureEntries(model)), localPacks, source };
}

server.registerTool(
  "vision_summary",
  {
    title: "VisionLayer — Sommaire du système",
    description:
      "À appeler en premier, avant de chercher dans le code. Une ligne par élément du système, sans code : points d'entrée (routes, tâches planifiées, consommateurs de messages) avec leur fonction et leur garde, tables avec le nombre d'écritures et de lectures, files, constats, ce qui n'est pas lu. Choisis ce qui concerne ta tâche, puis appelle vision_slice avec les noms de la première colonne.",
    inputSchema: {
      block: z.string().optional().describe("Sur un grand système : ne donner que ce bloc (son nom, première colonne de la liste des blocs)"),
      root: z.string().optional().describe("Racine du dépôt (défaut : le dossier d'où le serveur a été lancé)"),
    },
  },
  async ({ block, root }) => {
    try {
      const dir = resolve(root ?? DEFAULT_ROOT);
      const { index, knowledge, localPacks } = await currentMap(dir);
      return plainText(buildSummary(index, { block, knowledge, workspace: workspaceLines(dir), ...(localPacks ? { localPacks } : {}) }));
    } catch (err) {
      return errorResult(`vision_summary a échoué: ${(err as Error).message}`);
    }
  },
);

server.registerTool(
  "vision_slice",
  {
    title: "VisionLayer — Tranche du système",
    description:
      "La partie du système reliée à ce que tu as choisi dans vision_summary : la fonction et la garde d'un point d'entrée, son déroulé, les autres endroits qui écrivent ou lisent les mêmes données (avec les valeurs écrites), qui traite ses messages, les constats et ce que les agents ont déclaré. Que des adresses fichier:ligne à lire ensuite, sans code, de la plus proche à la plus lointaine. Lis ces lignes avant de modifier.",
    inputSchema: {
      elements: z.array(z.string()).min(1).describe("Noms de la première colonne du sommaire : route (« POST /bookings »), fonction, table, file, constat (« code@fichier:ligne ») ou adresse « fichier:ligne »"),
      root: z.string().optional().describe("Racine du dépôt (défaut : le dossier d'où le serveur a été lancé)"),
    },
  },
  async ({ elements, root }) => {
    try {
      const { index, knowledge } = await currentMap(resolve(root ?? DEFAULT_ROOT));
      const dir = resolve(root ?? DEFAULT_ROOT);
      const slice = buildSlice(index, elements, { knowledge });
      for (const i of slice.items) sentFor(dir).add(itemKey(i));
      return plainText(formatSlice(slice, elements));
    } catch (err) {
      return errorResult(`vision_slice a échoué: ${(err as Error).message}`);
    }
  },
);

server.registerTool(
  "vision_reach",
  {
    title: "VisionLayer — Portée de ta modification",
    description:
      "À appeler après avoir modifié le code, avant de conclure. Lit ce qui a changé depuis le dernier commit (git diff et fichiers nouveaux), retrouve sur la carte ce que chaque ligne touche (fonction, point d'entrée, champ de table), puis donne la tranche de tout cela : routes et tâches atteintes, autres lecteurs et écrivains des mêmes données, constats. Dis ensuite, pour chaque constat, si ta modification le touche ou l'aggrave.",
    inputSchema: {
      root: z.string().optional().describe("Racine du dépôt (défaut : le dossier d'où le serveur a été lancé)"),
    },
  },
  async ({ root }) => {
    try {
      const dir = resolve(root ?? DEFAULT_ROOT);
      const { index, knowledge } = await currentMap(dir);
      const reach = buildReach(index, changedLines(dir), { knowledge, sent: sentFor(dir) });
      for (const i of reach.slice.items) sentFor(dir).add(itemKey(i));
      return plainText(formatReach(reach));
    } catch (err) {
      return errorResult(`vision_reach a échoué: ${(err as Error).message}`);
    }
  },
);



server.registerTool(
  "vision_source",
  {
    title: "VisionLayer — Où est déclaré un nom, et qui l'appelle",
    description: "Pour un nom de fonction, de classe, de méthode (`Classe.methode` ou `methode`), de constante, d'interface ou de type : où il est déclaré (fichier:début-fin), puis chaque endroit du code qui l'appelle. À employer au lieu de grep pour trouver une déclaration ou ses appels.",
    inputSchema: {
      name: z.string().describe("Le nom cherché : `deleteArchivedEmail`, `ArchivedEmailService.deleteArchivedEmail`, `requireAuth`"),
      root: z.string().optional().describe("Racine du dépôt (défaut : le dépôt où l'agent travaille)"),
    },
  },
  async ({ name, root }) => {
    try {
      const dir = resolve(root ?? DEFAULT_ROOT);
      const { source } = await currentMap(dir);
      const index = declarationIndexes.get(dir) ?? declarationIndexes.set(dir, new DeclarationIndex(dir)).get(dir)!;
      return plainText(formatSource(name, index.find(name), source.database()!));
    } catch (err) {
      return errorResult(`vision_source a échoué: ${(err as Error).message}`);
    }
  },
);



const transport = new StdioServerTransport();
await server.connect(transport);
