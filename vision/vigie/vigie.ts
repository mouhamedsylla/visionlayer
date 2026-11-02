import type { ArchModelV2, ArchNode, Entrypoint, FlowStep, Proof } from "../arch/types.js";
import { readExcerpt } from "../web/source.js";
import { apiKey, MODEL } from "../writer/spark.js";

/**
 * Vigie : l'assistant de VisionLayer répond sur le système, et seulement depuis ce que VisionLayer a lu.
 * Muse Spark appelle des outils qui lisent la carte et le code cité par elle ; chaque affirmation porte son
 * `fichier:ligne`, et ce qu'aucun outil ne couvre est dit « non lu ». Vigie n'écrit jamais la carte et ne
 * touche pas au projet.
 */
const ENDPOINT = "https://api.meta.ai/v1/responses";
const PRICE_IN = 1.25e-6, PRICE_OUT = 4.25e-6;
/** Une garde contre une boucle, pas un plafond de travail : une question se règle en quelques appels. */
const MAX_TURNS = 8;
const CAP = 6000;

export interface VigieStep { tool: string; input: Record<string, unknown>; chars: number }
export interface VigieAnswer { answer: string; steps: VigieStep[]; citations: { path: string; line: number }[]; usage: { input: number; output: number; cost: number; seconds: number; turns: number }; model: string }

const INSTRUCTIONS = `Tu es Vigie, dans VisionLayer. Tu réponds en français, à un ingénieur, sur le système logiciel qu'il a ouvert.
Règles :
- Réponds uniquement à partir de ce que les outils rendent. N'invente rien, ne suppose rien.
- Chaque affirmation porte sa preuve, au format chemin:ligne, recopiée d'un résultat d'outil.
- Si les outils ne couvrent pas la question, dis « non lu » et dis ce qui manquerait pour le savoir.
- Commence par la réponse en une phrase, puis les preuves. Au plus 150 mots. Les noms de routes, fonctions, tables et fichiers entre accents graves.
- Tu ne proposes pas de correctif de code.`;

const TOOLS = [
  fn("system_overview", "Les blocs du système (programmes, stockages, files, services extérieurs), leurs rôles, leurs points d'entrée et leurs liens, chacun avec sa preuve.", {}),
  fn("entrypoints", "Les points d'entrée (routes HTTP, tâches planifiées, files consommées) : bloc, garde lue (ouverte, connexion, rôle, signée, non reconnue) et la fonction qui la vérifie, fonction appelée. Filtre facultatif sur le texte.", { filter: { type: "string" } }, []),
  fn("flow", "Le déroulé d'un point d'entrée (sa clé, ex. « POST /bookings ») ou d'une fonction (son nom) : ses étapes dans l'ordre du code, lectures, écritures, mises en file, appels, refus, chacune avec chemin:ligne.", { name: { type: "string" } }),
  fn("findings", "Les constats des règles de VisionLayer (routes sans garde attendue, courses, données personnelles, tâches lancées sur chaque machine…), chacun avec ses preuves.", {}),
  fn("table", "Une table ou une file : ses champs, ses états, qui la lit et qui l'écrit, avec les lignes.", { name: { type: "string" } }),
  fn("source", "Les lignes d'un fichier cité par la carte, de from à to (80 lignes au plus).", { path: { type: "string" }, from: { type: "integer" }, to: { type: "integer" } }),
];

function fn(name: string, description: string, properties: Record<string, unknown>, required = Object.keys(properties)) {
  return { type: "function", name, description, parameters: { type: "object", additionalProperties: false, properties, required: required.length ? required : Object.keys(properties) }, strict: Object.keys(properties).length === required.length };
}

const at = (p?: Proof | { path: string; line: number }) => p ? `${p.path}:${p.line}` : "";

export async function askVigie(root: string, model: ArchModelV2, question: string): Promise<VigieAnswer> {
  const key = apiKey();
  const t0 = Date.now();
  const steps: VigieStep[] = [];
  const usage = { input: 0, output: 0, cost: 0, seconds: 0, turns: 0 };
  let previous: string | undefined;
  let input: unknown[] = [{ role: "user", content: question }];
  let answer = "";
  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const last = turn === MAX_TURNS;
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, instructions: INSTRUCTIONS, input, ...(last ? {} : { tools: TOOLS }), ...(previous ? { previous_response_id: previous } : {}) }),
    });
    const data = await res.json() as { id: string; output: { type: string; call_id?: string; name?: string; arguments?: string; content?: { text?: string }[] }[]; usage: { input_tokens: number; output_tokens: number } };
    if (!res.ok) throw new Error(`Muse Spark : ${res.status} ${JSON.stringify(data).slice(0, 300)}`);
    previous = data.id;
    usage.turns = turn; usage.input += data.usage.input_tokens; usage.output += data.usage.output_tokens;
    const calls = data.output.filter((o) => o.type === "function_call");
    const said = data.output.filter((o) => o.type === "message").flatMap((o) => o.content ?? []).map((c) => c.text ?? "").join("\n").trim();
    if (!calls.length) { answer = said; break; }
    input = [];
    for (const c of calls) {
      const args = JSON.parse(c.arguments || "{}") as Record<string, unknown>;
      let out: string;
      try { out = run(root, model, c.name!, args); } catch (e) { out = `erreur : ${(e as Error).message}`; }
      if (out.length > CAP) out = out.slice(0, CAP) + "\n[tronqué]";
      steps.push({ tool: c.name!, input: args, chars: out.length });
      input.push({ type: "function_call_output", call_id: c.call_id, output: out });
    }
  }
  usage.cost = usage.input * PRICE_IN + usage.output * PRICE_OUT;
  usage.seconds = Math.round((Date.now() - t0) / 1000);
  const citations = [...new Map([...answer.matchAll(/([\w./@()[\]-]+\.\w+):(\d+)/g)].map((m) => [`${m[1]}:${m[2]}`, { path: m[1]!, line: Number(m[2]) }])).values()];
  return { answer: answer || "Vigie n'a pas conclu : non lu.", steps, citations, usage, model: MODEL };
}

/** Les outils : chacun ne lit que la carte, ou le code qu'elle cite. */
function run(root: string, m: ArchModelV2, tool: string, a: Record<string, unknown>): string {
  const nodes = m.nodes.filter((n) => n.level !== "component");
  const name = (id: string) => m.nodes.find((n) => n.id === id)?.name ?? id;
  const entries = nodes.flatMap((n) => (n.facets.entrypoints ?? []).map((e) => ({ n, e })));
  const guard = (e: Entrypoint) => e.access ? `${e.access.level}${e.access.by ? ` par ${e.access.by.name} ${e.access.by.path}:${e.access.by.line}` : ""}${e.access.roles?.length ? ` rôles ${e.access.roles.join(",")}` : ""}` : "garde non lue";
  const steps = (flow: FlowStep[] = []) => flow.map((s) => `${"  ".repeat(s.depth)}${s.kind} ${s.target?.entity ?? s.target?.topic ?? s.name ?? ""}${s.status ? ` ${s.status}` : ""}${s.when ? ` si ${s.when}` : ""} ${at(s.proof)}`).join("\n");
  switch (tool) {
    case "system_overview":
      return [...nodes.map((n: ArchNode) => `${n.name} (${n.role}) ${n.summary ?? n.subtitle ?? ""} ${at(n.proof[0])}`),
        ...m.edges.filter((e) => nodes.some((n) => n.id === e.from) && nodes.some((n) => n.id === e.to)).slice(0, 80).map((e) => `${name(e.from)} ${e.kind} ${name(e.to)}${e.target?.entity ? ` ${e.target.entity}` : ""} ×${e.count} ${at(e.occurrences[0])}`)].join("\n");
    case "entrypoints": {
      const f = String(a.filter ?? "").toLowerCase();
      return entries.filter(({ e }) => !f || `${e.key} ${e.handler?.name ?? ""}`.toLowerCase().includes(f)).map(({ n, e }) => `${n.name}\t${e.kind}\t${e.key}\tgarde: ${guard(e)}\tfonction: ${e.handler ? `${e.handler.name} ${e.handler.path}:${e.handler.line}` : "?"}\tdéclarée ${at(e.proof)}`).join("\n") || "aucun point d'entrée ne correspond";
    }
    case "flow": {
      const q = String(a.name ?? "");
      const hit = entries.find(({ e }) => e.key === q || e.key.toLowerCase() === q.toLowerCase());
      if (hit) return `${hit.e.key}, garde: ${guard(hit.e)}, fonction ${hit.e.handler?.name ?? "?"} ${hit.e.handler ? `${hit.e.handler.path}:${hit.e.handler.line}` : ""}\n${steps(hit.e.flow)}`;
      const f = nodes.flatMap((n) => n.facets.functions ?? []).find((x) => x.name === q || x.name.endsWith(`.${q}`));
      return f ? `${f.name} ${at(f.proof)}\n${steps(f.flow)}` : "non trouvé sur la carte";
    }
    case "findings":
      return m.findings.map((f) => `${f.code} : ${f.message} [${f.proof.slice(0, 4).map(at).join(", ")}]`).join("\n") || "aucun constat";
    case "table": {
      const q = String(a.name ?? "");
      const store = nodes.find((n) => n.facets.data?.entities.some((e) => e.name === q));
      const ent = store?.facets.data?.entities.find((e) => e.name === q);
      const touch = m.edges.filter((e) => (e.target?.entity ?? e.target?.topic) === q).map((e) => `${name(e.from)} ${e.kind} ×${e.count} ${e.occurrences.slice(0, 3).map(at).join(", ")}`);
      if (!ent && !touch.length) return "table non lue";
      return [`${q}${store ? ` dans ${store.name}` : ""} ${at(ent?.proof)}`, ...(ent?.fields ?? []).map((f) => `  ${f.name}${f.values?.length ? ` états ${f.values.join("|")}` : ""}${f.writes?.length ? ` écrit ${f.writes.slice(0, 3).map((w) => `${w.value ?? ""} par ${w.fn ?? "?"} ${at(w.proof)}`).join("; ")}` : ""}`), ...touch].join("\n");
    }
    case "source": {
      const from = Math.max(1, Number(a.from) || 1), to = Math.min(from + 79, Number(a.to) || from + 40);
      const x = readExcerpt(root, m, String(a.path), from, to);
      return x.lines.map((l, i) => `${x.from + i}\t${l}`).join("\n");
    }
  }
  return `outil inconnu : ${tool}`;
}
