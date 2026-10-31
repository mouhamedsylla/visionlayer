#!/usr/bin/env node
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readModel } from "../../vision/model/store.js";
import { buildAgentContext } from "../../vision/context/build.js";
import { buildInspectResult } from "../../vision/inspect/build.js";
import { resolveSymbol } from "../../vision/model/query.js";
import { assertWithinRepo } from "../../vision/model/paths.js";
import { readArchModel } from "../../vision/arch/store.js";
import { buildArchModel } from "../../vision/arch/build.js";
import { buildFlow } from "../../vision/arch/flow.js";
import { findBlock, formatArchModel, formatBlock, formatFlow, withoutPureCalls } from "../../vision/arch/format.js";
import { readInfraModel } from "../../vision/infra/store.js";
import { buildInfraModel } from "../../vision/infra/build.js";
import type { SystemModel } from "../../vision/model/types.js";
import { MapSource } from "../../vision/web/map-source.js";
import { featureEntries } from "../../vision/web/knowledge-source.js";
import { buildKnowledge } from "../../vision/knowledge/build.js";
import { MapIndex } from "../../vision/slice/index.js";
import { buildSummary } from "../../vision/slice/summary.js";
import { buildSlice, formatSlice } from "../../vision/slice/build.js";

/**
 * Serveur MCP RYPHA VisionLayer — MVP5.
 *
 * N'expose QUE des outils de lecture : vision_summary et vision_slice, qui
 * lisent la carte des packs (docs : contexte-des-agents-solution), puis
 * vision_context, vision_inspect, vision_source, vision_architecture et
 * vision_flow, qui lisent encore l'ancien modèle. `vision update`/`vision diff`/`vision report` restent
 * volontairement CLI-only, jamais exposés à un agent — mvp-roadmap.md
 * (MVP5) l'exige explicitement : la lecture peut s'automatiser sans
 * risque, l'écriture du modèle doit garder une étape humaine tant que la
 * fiabilité de VisionLayer n'est pas éprouvée (NIST AI RMF — Govern).
 */

/**
 * JSON compact, sans indentation : chaque espace d'indentation est un token
 * payé par l'agent à chaque appel (ADR 0013). Les outils d'architecture, eux,
 * renvoient du texte déjà condensé.
 */
function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

function plainText(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/** La carte persistée par `scan`/`update` ; recalculée seulement si elle manque (lecture seule : jamais réécrite ici). */
function loadArch(root: string, model: SystemModel) {
  return readArchModel(root) ?? buildArchModel(root, model, readInfraModel(root) ?? buildInfraModel(root));
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

const server = new McpServer({ name: "rypha-vision", version: "0.1.0" });

/**
 * La carte des packs, gardée par racine pendant la vie du serveur. Chaque
 * appel la rafraîchit : seuls les fichiers modifiés depuis l'appel précédent
 * sont relus, si bien qu'un agent qui vient de modifier du code reçoit la
 * carte de ce code-là.
 */
const maps = new Map<string, MapSource>();
async function currentMap(root: string) {
  const source = maps.get(root) ?? new MapSource(root);
  maps.set(root, source);
  const { model } = await source.refresh();
  return { index: new MapIndex(model), knowledge: buildKnowledge(root, featureEntries(model)) };
}

server.registerTool(
  "vision_summary",
  {
    title: "VisionLayer — Sommaire du système",
    description:
      "À appeler en premier, avant de chercher dans le code. Une ligne par élément du système, sans code : points d'entrée (routes, tâches planifiées, consommateurs de messages) avec leur fonction et leur garde, tables avec le nombre d'écritures et de lectures, files, constats, ce qui n'est pas lu. Choisis ce qui concerne ta tâche, puis appelle vision_slice avec les noms de la première colonne.",
    inputSchema: {
      block: z.string().optional().describe("Sur un grand système : ne donner que ce bloc (id de la première colonne de la liste des blocs)"),
      root: z.string().optional().describe("Racine du dépôt (défaut : répertoire courant)"),
    },
  },
  async ({ block, root }) => {
    try {
      const { index, knowledge } = await currentMap(resolve(root ?? "."));
      return plainText(buildSummary(index, { block, knowledge }));
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
      max: z.number().int().positive().optional().describe("Nombre de lignes au plus (défaut 45) ; les plus lointaines sont coupées et comptées"),
      root: z.string().optional().describe("Racine du dépôt (défaut : répertoire courant)"),
    },
  },
  async ({ elements, max, root }) => {
    try {
      const { index, knowledge } = await currentMap(resolve(root ?? "."));
      return plainText(formatSlice(buildSlice(index, elements, { knowledge, max }), elements));
    } catch (err) {
      return errorResult(`vision_slice a échoué: ${(err as Error).message}`);
    }
  },
);

server.registerTool(
  "vision_context",
  {
    title: "VisionLayer — Agent Context",
    description:
      "Renvoie les fichiers/symboles pertinents pour une tâche donnée (correspondance de mots-clés déterministe, plus leurs voisins directs dans le graphe de dépendances). Aucune interprétation sémantique — cf. ADR 0005.",
    inputSchema: {
      task: z.string().describe("Description en langage naturel de la tâche à implémenter"),
      detail: z
        .boolean()
        .optional()
        .describe("Inclure la liste de tous les symboles de chaque fichier (lourd). Défaut : false, seuls les symboles qui correspondent à la tâche sont donnés"),
      root: z.string().optional().describe("Racine du repository scanné (défaut: répertoire courant)"),
    },
  },
  async ({ task, detail, root }) => {
    try {
      const target = resolve(root ?? ".");
      const model = readModel(target);
      const ctx = buildAgentContext(model, task);
      if (detail) return textResult(ctx);
      // Projection économe : la liste complète des symboles de chaque fichier
      // représentait ~90 % du volume (sur Nafar : 38 k caractères → voir ADR 0013).
      return textResult({
        task: ctx.task,
        taskTokens: ctx.taskTokens,
        matchedFiles: ctx.matchedFiles.map((f) => ({ path: f.path, matchedSymbols: f.matchedSymbols, matchedReExports: f.matchedReExports })),
        relatedFiles: ctx.relatedFiles.map((f) => f.path),
        semanticInterpretationApplied: ctx.semanticInterpretationApplied,
        omitted: "allSymbols (detail: true pour les obtenir)",
      });
    } catch (err) {
      return errorResult(`vision_context a échoué: ${(err as Error).message}`);
    }
  },
);

server.registerTool(
  "vision_inspect",
  {
    title: "VisionLayer — Inspect",
    description:
      "Inspecte un fichier (par chemin) ou un symbole (par nom, en suivant les ré-exports si nécessaire) : symboles, dépendances, dépendants.",
    inputSchema: {
      query: z.string().describe("Chemin de fichier relatif OU nom de symbole"),
      root: z.string().optional().describe("Racine du repository scanné (défaut: répertoire courant)"),
    },
  },
  async ({ query, root }) => {
    try {
      const target = resolve(root ?? ".");
      const model = readModel(target);
      return textResult(buildInspectResult(model, target, query));
    } catch (err) {
      return errorResult(`vision_inspect a échoué: ${(err as Error).message}`);
    }
  },
);

server.registerTool(
  "vision_source",
  {
    title: "VisionLayer — Source",
    description: "Résout un nom de symbole jusqu'à sa déclaration réelle (chemin:ligne), en suivant les ré-exports.",
    inputSchema: {
      name: z.string().describe("Nom du symbole à localiser"),
      root: z.string().optional().describe("Racine du repository scanné (défaut: répertoire courant)"),
    },
  },
  async ({ name, root }) => {
    try {
      const target = resolve(root ?? ".");
      const model = readModel(target);
      const outcome = resolveSymbol(model, name);
      if (outcome.kind === "found") {
        assertWithinRepo(target, outcome.result.file.path);
      }
      return textResult(outcome);
    } catch (err) {
      return errorResult(`vision_source a échoué: ${(err as Error).message}`);
    }
  },
);

server.registerTool(
  "vision_architecture",
  {
    title: "VisionLayer — Architecture",
    description:
      "Ce qui s'exécute et qui parle à qui : blocs (apps, fonctions, conteneurs, bases, IA, files), liens prouvés par leur ligne, points d'entrée, collections. Sans `block` : la carte entière. Avec `block` (nom ou id, ex. \"Firestore\", \"Cloud Functions\") : ce bloc seul et son voisinage — à préférer pour économiser le contexte.",
    inputSchema: {
      block: z.string().optional().describe("Nom ou id d'un bloc pour ne recevoir que lui et ses liens"),
      root: z.string().optional().describe("Racine du repository scanné (défaut: répertoire courant)"),
    },
  },
  async ({ block, root }) => {
    try {
      const target = resolve(root ?? ".");
      const arch = loadArch(target, readModel(target));
      if (!block) return plainText(formatArchModel(arch));
      const b = findBlock(arch, block);
      if (!b) return errorResult(`bloc « ${block} » introuvable. Blocs : ${arch.blocks.map((x) => x.name).join(", ")}`);
      return plainText(formatBlock(arch, b));
    } catch (err) {
      return errorResult(`vision_architecture a échoué: ${(err as Error).message}`);
    }
  },
);

server.registerTool(
  "vision_flow",
  {
    title: "VisionLayer — Algorithme d'une feature",
    description:
      "L'algorithme d'une feature (point d'entrée : fonction appelable, route, déclencheur) dans l'ordre du code : conditions de refus, branches, lectures/écritures, IA, files, retours, avec la ligne de chaque étape, qui l'appelle et ce qu'elle déclenche. Les appels sans effet sont omis sauf `full: true`.",
    inputSchema: {
      feature: z.string().describe("Nom du point d'entrée (ex. videoCreate) ou d'une fonction"),
      full: z.boolean().optional().describe("Inclure les appels sans effet (calculs purs). Défaut : false"),
      root: z.string().optional().describe("Racine du repository scanné (défaut: répertoire courant)"),
    },
  },
  async ({ feature, full, root }) => {
    try {
      const target = resolve(root ?? ".");
      const model = readModel(target);
      const arch = loadArch(target, model);
      const entry = arch.entries.find((e) => e.name === feature || e.id === feature);
      let ref: { entry?: string; symbol?: string } | undefined = entry ? { entry: entry.id } : undefined;
      if (!ref) {
        const found = resolveSymbol(model, feature);
        if (found.kind === "found") ref = { symbol: found.result.symbol.id };
        else if (found.kind === "ambiguous") {
          return errorResult(`« ${feature} » est ambigu : ${found.results.map((r) => `${r.file.path}`).join(", ")}`);
        }
      }
      const flow = ref ? buildFlow(target, model, arch, ref) : undefined;
      if (!flow) {
        return errorResult(`feature « ${feature} » introuvable. Points d'entrée : ${arch.entries.map((e) => e.name).join(", ")}`);
      }
      assertWithinRepo(target, flow.symbol.path);
      return plainText(formatFlow(full ? flow : { ...flow, steps: withoutPureCalls(flow.steps) }, arch));
    } catch (err) {
      return errorResult(`vision_flow a échoué: ${(err as Error).message}`);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
