import type { ArchModelV2 } from "../../api/types";
import type { FactCard, FactVisual } from "../architecture/facts";
import type { GlanceNote } from "../../components/Glance";
import type { EntryRef } from "../features/list";
import { count, joinWords } from "../text/plural";
import type { CredentialStore } from "./credentials";
import type { GuardFn, GuardLevel, LevelRow } from "./guards";

/** Le niveau d'une garde dit en mots : la ligne de « Qui peut faire quoi », la pastille d'une route. */
export const LEVEL_LABEL: Record<GuardLevel, { title: string; short: string; many: string; tone: Extract<FactVisual, { type: "bar" }>["parts"][number]["tone"] }> = {
  public: { title: "Ouvert à tous", short: "publique", many: "publiques", tone: "pale" },
  signature: { title: "Signé par un service", short: "signée", many: "signées", tone: "cyan" },
  authenticated: { title: "Connecté", short: "connexion", many: "connexion", tone: "blue" },
  role: { title: "Rôle exigé", short: "rôle", many: "rôle", tone: "night" },
  internal: { title: "Interne", short: "interne", many: "internes", tone: "cyan" },
  unknown: { title: "Garde non reconnue", short: "non reconnue", many: "non reconnues", tone: "pale" },
};

interface Inputs {
  rows: LevelRow[];
  guards: GuardFn[];
  stores: CredentialStore[];
  open: EntryRef[];
}

/** Le bandeau : qui peut appeler, ce qui reconnaît l'appelant, où l'on obtient sa preuve, ce que la route vérifie, ce qui est constaté. */
export function identityFacts({ rows, guards, stores, open }: Inputs, model: ArchModelV2): FactCard[] {
  const total = rows.reduce((n, r) => n + r.entries.length, 0);
  const checked = rows.flatMap((r) => r.entries).filter((e) => e.checks.length);
  const findings = model.findings.filter((f) => f.code === "unguarded_route");
  const openWriting = rows.find((r) => r.level === "public")?.entries.filter((e) => e.writes.length) ?? [];
  const refusals = [...new Set(guards.flatMap((g) => g.refusals.map((r) => r.status)))].sort();
  return [
    {
      question: "Qui peut appeler", answer: count(total, "point d'entrée", "points d'entrée"),
      detail: openWriting.length ? `${count(openWriting.length, "entrée ouverte à tous écrit", "entrées ouvertes à tous écrivent")} : ${joinWords(openWriting.map((e) => e.entry.key))}` : "aucune entrée ouverte à tous n'écrit",
      visual: { type: "bar", parts: rows.map((r) => ({ label: r.entries.length > 1 ? LEVEL_LABEL[r.level].many : LEVEL_LABEL[r.level].short, value: r.entries.length, tone: LEVEL_LABEL[r.level].tone })) },
    },
    {
      question: "Ce qui reconnaît l'appelant", answer: guards.length ? joinWords(guards.map((g) => g.ref.name)) : "aucune garde lue",
      detail: guards.length ? `refuse ${refusals.join(", ")} · lit ${joinWords([...new Set(stores.map((s) => s.entity))]) || "rien de lu"}` : "aucune fonction du dépôt ne refuse en 401 ou 403 devant une route",
      ...(guards.length ? {} : { attention: true }),
    },
    {
      question: "Où l'on obtient sa preuve", answer: open.length ? count(open.length, "entrée ouverte", "entrées ouvertes") : "non trouvé",
      detail: open.length ? `${joinWords(open.map((e) => e.entry.key))} ${open.length > 1 ? "écrivent" : "écrit"} ${joinWords([...new Set(stores.filter((s) => s.writes.some((w) => open.includes(w.item))).map((s) => s.entity))])}` : "aucune entrée publique n'écrit ce que la garde lit",
    },
    {
      question: "Vérifié dans la route", answer: count(checked.length, "route", "routes"),
      detail: checked.length ? `refusent elles-mêmes sur l'appelant : ${joinWords(checked.map((e) => e.entry.key))}` : "aucune route ne vérifie l'appelant après la garde",
    },
    {
      question: "Constats", answer: findings.length ? count(findings.length, "route à vérifier", "routes à vérifier") : "aucun",
      detail: findings.length ? joinWords(findings.map((f) => f.message.match(/« ([^»]+) »/)?.[1] ?? f.message)) : "aucune route dont le chemin dit admin sans garde de rôle",
      ...(findings.length ? { attention: true } : {}),
    },
  ];
}

/** `À savoir` : les constats, ce que les routes ouvertes écrivent, puis ce que VisionLayer ne lit pas. */
export function identityNotes({ rows }: Inputs, model: ArchModelV2, unread: EntryRef[]): GlanceNote[] {
  const open = rows.find((r) => r.level === "public")?.entries.filter((e) => e.writes.length) ?? [];
  return [
    ...model.findings.filter((f) => f.code === "unguarded_route").map((f) => ({ text: f.message, tone: "attention" as const })),
    ...open.map((e) => ({ text: `${e.entry.key}, ouverte à tous, écrit ${joinWords(e.writes)}`, tone: "plain" as const })),
    ...(unread.length ? [{ text: `${count(unread.length, "point d'entrée", "points d'entrée")} sans garde lue : aucun pack ne sait lire la sienne`, tone: "attention" as const }] : []),
    { text: "Les comptes et leurs rôles réels ne sont pas lus : seulement ce que le code exige", tone: "plain" },
    { text: "Une route est dite publique quand aucune fonction du dépôt ne refuse en 401 ou 403 devant elle : une garde tenue ailleurs (un proxy, un service d'identité) n'est pas lue", tone: "plain" },
  ];
}
