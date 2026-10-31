import type { Guard } from "../arch/types.js";
import type { KnowledgeReport } from "../knowledge/types.js";
import { at, MapIndex } from "./index.js";

export const GUARD_LABEL: Record<Guard["level"], string> = {
  public: "aucune garde",
  authenticated: "connexion",
  role: "rôle",
  signature: "signature",
  internal: "interne",
  unknown: "garde non reconnue",
};

export const guardText = (g: Guard | undefined) => (g ? (g.level === "role" && g.roles?.length ? `rôle ${g.roles.join(", ")}` : GUARD_LABEL[g.level]) : "");

/** Au-delà, le sommaire ne donne que les blocs : on déplie celui qu'on veut (`block`). */
const MAX_ENTRIES = 80;

const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
/** Les colonnes sont séparées par deux espaces, sans alignement : chaque espace d'alignement est un token relu à chaque appel. */
const cols = (...parts: (string | undefined | false)[]) => `  ${parts.filter(Boolean).join("  ")}`;

/**
 * Le sommaire de la carte, une ligne par élément, sans code : ce qui démarre
 * du code, les données, les files, les constats, ce qui n'est pas lu. Chaque
 * ligne commence par le nom à donner à `vision_slice`. L'agent choisit selon
 * le sens de sa tâche ; la carte ne devine rien.
 */
export function buildSummary(index: MapIndex, opts: { block?: string; knowledge?: KnowledgeReport; workspace?: string[] } = {}): string {
  const { model } = index;
  const out: string[] = [`SOMMAIRE ${model.system.name}`, "Choisis ce qui concerne ta tâche, puis demande sa tranche à vision_slice avec les noms de la première colonne.", ""];
  const entries = index.entries.filter((e) => e.kind !== "main" && (!opts.block || e.node === opts.block));

  // Une carte sans aucun point d'entrée sur un dépôt dont le code est lu n'est pas un système vide : c'est un lancement non reconnu.
  const codeRead = model.coverage.filter((c) => c.unit === "files").reduce((n, c) => n + c.read, 0);
  if (!index.entries.some((e) => e.kind !== "main") && codeRead > 0) {
    out.push(
      `ATTENTION : aucun point d'entrée reconnu, alors que ${codeRead} fichiers de code sont lus. Le lancement des programmes n'a pas été compris :`,
      "leurs routes, tâches, lectures et écritures ne sont PAS dans cette carte. Ce qui suit est incomplet ; cherche dans le code comme d'habitude.",
      "",
    );
  }

  if (opts.workspace?.length) out.push(...opts.workspace, "");

  if (!opts.block && entries.length > MAX_ENTRIES) {
    out.push("BLOCS (trop grand pour tout lister : relance vision_summary avec block)");
    for (const n of model.nodes.filter((n) => n.level === "deployable")) {
      const own = entries.filter((e) => e.node === n.id).length;
      const tables = n.facets.data?.entities.length ?? 0;
      out.push(cols(n.id, `${n.role}${own ? `, ${own} points d'entrée` : ""}${tables ? `, ${tables} tables` : ""}`));
    }
    return out.join("\n");
  }

  out.push("POINTS D'ENTRÉE");
  for (const e of entries) {
    const name = index.entryName(e);
    const key = name === e.key ? "" : e.key;
    const handler = e.handler ? `${e.kind === "http" ? e.handler.name + " " : ""}${at(e.handler)}` : at(e.proof);
    out.push(cols(name, e.kind, e.node, key, handler, e.kind === "http" && e.access && guardText(e.access)));
  }

  const entities = index.entities.filter((t) => !opts.block || t.node === opts.block || index.occurrences("write", { entity: t.name }).some((o) => o.node === opts.block));
  if (entities.length) {
    out.push("", "DONNÉES");
    for (const t of entities) {
      const w = index.occurrences("write", { entity: t.name }).length, r = index.occurrences("read", { entity: t.name }).length;
      const states = (t.fields ?? []).filter((f) => f.values?.length).map((f) => `${f.name} (${f.values!.join(", ")})`);
      const access = w + r ? `écrite à ${w} endroit${w > 1 ? "s" : ""}, lue à ${r}` : "aucun accès lu";
      out.push(cols(`${t.node}/${t.name}`, access, states.length > 0 && `valeurs : ${states.join(" ; ")}`));
    }
  }

  if (index.topics.length) {
    out.push("", "FILES ET MESSAGES");
    for (const t of index.topics) {
      const producers = index.occurrences("message", { topic: t.name }).length;
      const consumers = index.entries.filter((e) => e.kind === "message" && e.key === t.name).map((e) => `${index.entryName(e)} (${e.node})`);
      out.push(cols(t.name, `${producers ? `déposé à ${producers} endroit${producers > 1 ? "s" : ""}` : "aucun dépôt lu"}, traité par ${consumers.join(", ") || "rien de lu"}`));
    }
  }

  if (model.findings.length) {
    out.push("", "CONSTATS");
    for (const f of model.findings) out.push(cols(`${f.code}@${at(f.proof[0]!)}`, short(f.message, 110)));
  }

  const features = (opts.knowledge?.concepts ?? []).filter((c) => c.kind === "feature");
  if (features.length) {
    out.push("", "FEATURES DÉCLARÉES PAR LES AGENTS");
    for (const c of features) {
      const purpose = c.claims.find((k) => k.type === "purpose");
      out.push(cols(c.name, c.entries.map((e) => e.name).join(", "), purpose && short(purpose.text, 100)));
    }
  }

  const gaps = model.coverage.flatMap((c) => c.gaps);
  if (gaps.length) {
    out.push("", "NON LU (rien de ce qui suit n'est dans la carte)");
    for (const g of gaps) out.push(`  ${g.kind} ${g.subject} (${g.count})${g.proof ? ` ${at(g.proof)}` : ""}`);
  }
  return out.join("\n");
}
