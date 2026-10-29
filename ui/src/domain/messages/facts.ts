import type { ArchModelV2 } from "../../api/types";
import type { FactCard } from "../architecture/facts";
import { entryNature } from "../block/entries";
import type { EntryRef } from "../features/list";
import { count, joinWords } from "../text/plural";
import { branchesOf, launchesOf, sendersOf } from "./triggers";

const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];

/** Le bandeau de « Sans clic » : combien de chaque nature, ce qui part plusieurs fois, et ce que le code ne dit pas. */
export function backgroundFacts(entries: EntryRef[], model: ArchModelV2, names: Map<string, string>): FactCard[] {
  const of = (nature: string) => entries.filter((x) => entryNature(x.entry) === nature);
  const crons = of("planifiée");
  const queues = of("file");
  const hooks = [...of("webhook"), ...of("événement")];
  const launches = uniq(crons.map((x) => launchesOf(x, model)?.times.toString()));
  const multi = crons.filter((x) => launchesOf(x, model));
  const where = (xs: EntryRef[]) => uniq(xs.map((x) => x.entry.proof.path));
  const packs = (xs: EntryRef[]) => uniq(xs.map((x) => x.entry.proof.pack));
  const first = multi[0] && launchesOf(multi[0], model);
  return [
    {
      question: "Tâches planifiées", answer: crons.length ? String(crons.length) : "aucune",
      detail: crons.length ? `${joinWords(packs(crons))}, dans ${joinWords(where(crons))}` : "aucune horloge lue dans le code",
    },
    {
      question: "Files écoutées", answer: queues.length ? `${queues.length} : ${queues.map((x) => x.entry.key).join(", ")}` : "aucune",
      detail: queues.length ? queues.map((x) => `${x.entry.handler?.name ?? "fonction non reliée"}, dans ${x.node.name}`).join(" · ") : "aucun consommateur de file lu",
    },
    {
      question: "Événements reçus",
      answer: hooks.length ? hooks.map((x) => `${joinWords(sendersOf(x.entry, model, names)) || x.entry.key}${branchesOf(x.entry).length ? ` · ${count(branchesOf(x.entry).length, "branche")}` : ""}`).join(", ") : "aucun",
      detail: hooks.length ? hooks.map((x) => x.entry.key).join(" · ") : "aucune route appelée par un service externe",
    },
    {
      question: "Lancées plusieurs fois",
      answer: !multi.length ? "aucune lue" : multi.length === crons.length && crons.length > 1 ? `les ${crons.length} tâches planifiées` : count(multi.length, "tâche planifiée", "tâches planifiées"),
      detail: first ? `${joinWords(uniq(multi.map((x) => x.node.name)))} ${launches.length === 1 ? `tourne en ${launches[0]} exemplaires` : "tourne en plusieurs exemplaires"} · ${first.finding.proof.at(-1)!.path}` : "d'après le nombre d'exemplaires déclaré au déploiement",
      attention: multi.length > 0,
    },
    { question: "Ce qu'on ne sait pas", answer: "si elles ont tourné", detail: "aucune trace d'exécution n'est lue, seulement le code et le déploiement", attention: true },
  ];
}
