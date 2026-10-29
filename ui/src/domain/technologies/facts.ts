import type { ArchModelV2, StackModel } from "../../api/types";
import type { FactCard } from "../architecture/facts";
import type { GlanceNote } from "../../components/Glance";
import { count, joinWords } from "../text/plural";
import { evidenceWhere, externalTechIds } from "./groups";

/** Le bandeau de l'écran : ce qui est trouvé, les services appelés hors du système, les variables, les versions, les langages. */
export function techFacts(stack: StackModel, model: ArchModelV2): FactCard[] {
  const techs = stack.technologies.filter((t) => t.category !== "library");
  const libs = stack.technologies.length - techs.length;
  const files = new Set(stack.technologies.flatMap((t) => t.evidence.filter((e) => e.kind !== "files").map((e) => evidenceWhere(e).replace(/:\d+$/, ""))));
  const external = externalTechIds(model);
  const ext = stack.technologies.filter((t) => external.has(t.id));
  const extNodes = new Set(model.nodes.filter((n) => n.role === "external" && n.tech?.some((id) => external.has(id))).map((n) => n.id));
  const callers = [...new Set(model.edges.filter((e) => extNodes.has(e.to)).map((e) => e.from))].map((id) => model.nodes.find((n) => n.id === id)?.name ?? id);
  const env = new Set(model.nodes.flatMap((n) => (n.facets.config?.env ?? []).map((v) => v.name)));
  const total = stack.languages.reduce((n, l) => n + l.files, 0);
  const top = stack.languages[0];
  return [
    { question: "Technologies", answer: `${techs.length} trouvées`, detail: `dans ${count(files.size, "fichier")} du dépôt${libs ? `, plus ${count(libs, "autre bibliothèque", "autres bibliothèques")}` : ""}` },
    {
      question: "Services externes", answer: ext.length ? `${ext.length} : ${joinWords(ext.map((t) => t.name))}` : "aucun",
      detail: callers.length ? `appelés par ${joinWords(callers)}` : "aucun bloc externe sur la carte", attention: ext.length > 0,
    },
    { question: "Variables d'environnement", answer: count(env.size, "nom"), detail: "lues dans le code, jamais les valeurs" },
    { question: "Versions", answer: "celles déclarées", detail: "VisionLayer ne dit pas si c'est à jour" },
    ...(top ? [{ question: "Langages", answer: `${top.name} ${Math.round((top.files / total) * 100)} %`, detail: stack.languages.map((l) => `${l.name} ${count(l.files, "fichier")}`).join(" · ") }] : []),
  ];
}

/** `À savoir` : les écarts que l'inventaire relève, puis ce qu'il ne fait pas. */
export function techNotes(stack: StackModel): GlanceNote[] {
  const libs = stack.technologies.filter((t) => t.category === "library").length;
  return [
    ...stack.warnings.map((w) => ({ text: w.message, tone: "attention" as const })),
    ...(libs ? [{ text: `${count(libs, "paquet")} hors du catalogue, listés sous leur propre nom`, tone: "plain" as const }] : []),
    { text: "Une version n'est jamais comparée à la dernière publiée", tone: "plain" },
  ];
}
