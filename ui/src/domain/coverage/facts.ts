import type { ArchModelV2, KnowledgePayload } from "../../api/types";
import type { FactCard } from "../architecture/facts";
import { count } from "../text/plural";
import { outdated, upToDate, type Measures } from "./measure";

const gapWords = (g: ArchModelV2["coverage"][number]["gaps"][number]) =>
  g.kind === "language_not_read" ? `${g.count} ${g.subject} non lus` : g.kind === "pack_missing" ? `${g.subject} sans pack` : `${g.count} ${g.subject}`;

const of = (ok: number, total: number, word: string) => `${ok} sur ${total} ${word}`;

/** Le bandeau : ce que la carte sait rattacher, expliquer, lire, et l'état des notes déclarées. */
export function coverageFacts(model: ArchModelV2, m: Measures, payload: KnowledgePayload): FactCard[] {
  const attached = m.entries.filter((e) => e.attached).length;
  const features = payload.report.concepts.filter((c) => c.kind === "feature").length;
  const explained = m.refusals.filter((r) => r.explained).length;
  const read = m.tables.filter((t) => t.read).length;
  const fresh = m.claims.filter(upToDate).length;
  const stale = m.claims.filter(outdated).length;
  const verified = m.claims.filter((c) => c.state === "verified").length;
  const files = model.coverage.find((c) => c.unit === "files");
  return [
    {
      question: "Points d'entrée", answer: of(attached, m.entries.length, "rattachés"),
      detail: features ? `à l'une des ${count(features, "feature déclarée", "features déclarées")}` : "aucune feature déclarée dans .vision/knowledge",
    },
    { question: "Tables", answer: of(read, m.tables.length, "lues"), detail: "champ par champ, dans le code ou le schéma" },
    { question: "Refus", answer: of(explained, m.refusals.length, "expliqués"), detail: "par un commentaire de l'auteur ou une note ancrée sur leur ligne" },
    {
      question: "Notes", answer: m.claims.length ? of(fresh, m.claims.length, "à jour") : "aucune",
      detail: m.claims.length ? `${verified} vérifiées par une règle${stale ? `, ${stale} à relire` : ""}` : "les agents et les humains en déclarent en travaillant",
      attention: stale > 0,
    },
    ...(files ? [{
      question: "Code lu", answer: of(files.read, files.total, "fichiers"),
      detail: files.gaps.length ? files.gaps.map(gapWords).join(" · ") : "rien n'est resté non lu", attention: files.read < files.total,
    }] : []),
  ];
}
