import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Pack } from "../facts/packs.js";
import type { Brief } from "./brief.js";
import { checkForAgent, syntaxTree } from "./tools.js";

/**
 * L'assistant Muse suit la fiche : Muse Spark, par la Responses API de Meta, avec trois outils.
 * Il écrit, vérifie, corrige, et ne rend le pack que quand `check_pack` l'accepte. Chaque échange
 * est gardé : ce que l'agent a essayé, ce que les tests lui ont répondu.
 */
export const MODEL = "muse-spark-1.3";
const ENDPOINT = "https://api.meta.ai/v1/responses";
/** Prix de Muse Spark 1.3, en dollars par token lu et écrit. */
const PRICE_IN = 1.25e-6, PRICE_OUT = 4.25e-6;
/** Une garde contre une boucle sans fin, pas un plafond de travail : un pack s'écrit en quelques dizaines d'échanges. */
const MAX_TURNS = 120;

export interface Step { turn: number; tool: string; input: unknown; output: string }
export interface WriteResult {
  yaml?: string;
  doc?: string;
  steps: Step[];
  /** Ce que l'agent a dit en dernier, s'il s'arrête sans rendre de pack. */
  said?: string;
  usage: { input: number; output: number; cost: number; turns: number; seconds: number };
}

const TOOLS = [
  {
    type: "function", name: "syntax_tree", strict: true,
    description: "Rend l'arbre syntaxique tree-sitter exact d'un exemple de code : un nœud nommé par ligne, son champ, sa ligne, le texte des feuilles.",
    parameters: { type: "object", additionalProperties: false, required: ["code", "language"], properties: {
      code: { type: "string" }, language: { type: "string", enum: ["typescript", "tsx", "javascript"] } } },
  },
  {
    type: "function", name: "check_pack", strict: true,
    description: "Vérifie un pack YAML : schéma, provides, arités, puis chaque test dans un dossier à part avec les packs livrés. Rend, par test, ce qui manque, ce qui sort à tort et les faits produits.",
    parameters: { type: "object", additionalProperties: false, required: ["yaml"], properties: { yaml: { type: "string" } } },
  },
  {
    type: "function", name: "submit_pack", strict: true,
    description: "Rend le pack final et sa page de documentation en français (tableau des formes : numéro, forme, exemple, état). Refusé si check_pack le refuse.",
    parameters: { type: "object", additionalProperties: false, required: ["yaml", "doc"], properties: { yaml: { type: "string" }, doc: { type: "string" } } },
  },
];

export function apiKey(): string {
  if (process.env.MODEL_API_KEY) return process.env.MODEL_API_KEY;
  if (process.env.META_API_KEY) return process.env.META_API_KEY;
  const file = join(homedir(), ".visionlayer.env");
  const key = existsSync(file) ? readFileSync(file, "utf8").match(/^MODEL_API_KEY=(.*)$/m)?.[1]?.trim() : undefined;
  if (!key) throw new Error("clé absente : ni MODEL_API_KEY ou META_API_KEY dans l'environnement, ni MODEL_API_KEY dans ~/.visionlayer.env");
  return key;
}

/**
 * L'essai d'un pack sur le projet ouvert, à part : s'il n'ajoute rien, le pack est rendu à l'agent avec des comptes,
 * jamais une ligne du projet. `previous` : un pack déjà écrit qui n'ajoutait rien, à corriger plutôt qu'à réécrire.
 */
export interface WriteOptions {
  onStep?: (s: Step) => void;
  tryOnProject?: (yaml: string) => Promise<{ adds: boolean; feedback: string }>;
  previous?: { yaml: string; feedback: string };
}

/** Une coupure réseau ou une erreur passagère du service ne coûte pas tout le travail déjà fait. */
export async function withRetry(call: () => Promise<Response>, tries = 4, wait = 5000): Promise<Response> {
  for (let i = 1; ; i++) {
    try {
      const r = await call();
      if ((r.status !== 429 && r.status < 500) || i >= tries) return r;
    } catch (e) {
      if (i >= tries) throw e;
    }
    await new Promise((ok) => setTimeout(ok, wait * i));
  }
}

/** Combien de fois un pack qui n'ajoute rien lui est rendu, avant de s'arrêter. */
const MAX_RETURNS = 3;

export async function writePack(brief: Brief, builtins: Pack[], opts: WriteOptions = {}): Promise<WriteResult> {
  const key = apiKey();
  const t0 = Date.now();
  const steps: Step[] = [];
  const usage = { input: 0, output: 0, cost: 0, turns: 0, seconds: 0 };
  let previous: string | undefined;
  let returned = 0;
  let input: unknown[] = [{ role: "user", content: opts.previous
    ? `Voici ton pack de \`${brief.pkg}\`. Il passe ses tests, mais il n'ajoute rien sur le projet où il a été essayé.\n\n${opts.previous.feedback}\n\nCorrige-le, sans repartir de zéro, puis termine par submit_pack.\n\n\`\`\`yaml\n${opts.previous.yaml}\n\`\`\``
    : `Écris le pack de \`${brief.pkg}\` en suivant la fiche. Termine par submit_pack.` }];
  let result: WriteResult | undefined;
  let said: string | undefined;

  for (let turn = 1; turn <= MAX_TURNS && !result; turn++) {
    const res = await withRetry(() => fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, instructions: brief.text, input, tools: TOOLS, ...(previous ? { previous_response_id: previous } : {}) }),
    }));
    const data = await res.json() as { id: string; output: { type: string; call_id?: string; name?: string; arguments?: string; content?: { text?: string }[] }[]; usage: { input_tokens: number; output_tokens: number } };
    if (!res.ok) throw new Error(`Muse Spark : ${res.status} ${JSON.stringify(data).slice(0, 400)}`);
    previous = data.id;
    usage.turns = turn;
    usage.input += data.usage.input_tokens;
    usage.output += data.usage.output_tokens;

    const calls = data.output.filter((o) => o.type === "function_call");
    said = data.output.filter((o) => o.type === "message").flatMap((o) => o.content ?? []).map((c) => c.text ?? "").join("\n").trim() || said;
    if (!calls.length) {
      // Il parle sans appeler d'outil : on le renvoie à la fiche, une fois par tour.
      input = [{ role: "user", content: "Continue jusqu'à submit_pack, avec les outils." }];
      continue;
    }
    input = [];
    for (const c of calls) {
      const args = JSON.parse(c.arguments ?? "{}") as Record<string, string>;
      let output: string;
      try {
        if (c.name === "syntax_tree") output = syntaxTree(args.code!, (args.language ?? "typescript") as "typescript");
        else if (c.name === "check_pack") output = (await checkForAgent(args.yaml!, builtins)).text;
        else if (c.name === "submit_pack") {
          const check = await checkForAgent(args.yaml!, builtins);
          output = check.ok ? "Pack reçu." : `Refusé, corrige puis rends-le de nouveau :\n${check.text}`;
          if (check.ok) {
            const tried = returned < MAX_RETURNS ? await opts.tryOnProject?.(args.yaml!) : undefined;
            if (tried && !tried.adds) { returned++; output = `Refusé : il passe ses tests, mais il n'ajoute rien sur le projet où il a été essayé.\n\n${tried.feedback}\n\nCorrige-le puis rends-le de nouveau.`; }
            else result = { yaml: args.yaml!, doc: args.doc!, steps, usage };
          }
        } else output = `outil inconnu : ${c.name}`;
      } catch (e) {
        output = `erreur : ${(e as Error).message}`;
      }
      const step = { turn, tool: c.name!, input: args, output };
      steps.push(step);
      opts.onStep?.(step);
      input.push({ type: "function_call_output", call_id: c.call_id, output });
    }
  }
  usage.cost = usage.input * PRICE_IN + usage.output * PRICE_OUT;
  usage.seconds = Math.round((Date.now() - t0) / 1000);
  return result ? { ...result, usage } : { steps, usage, ...(said ? { said } : {}) };
}
