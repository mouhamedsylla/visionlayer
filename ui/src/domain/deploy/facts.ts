import type { DeployPayload } from "../../api/types";
import type { FactCard } from "../architecture/facts";
import type { GlanceNote } from "../../components/Glance";
import { count, joinWords } from "../text/plural";
import { deploySteps } from "./chain";
import type { DeployPart } from "./parts";

/** Le bandeau : ce qui tourne, ce qui le déclare, la chaîne de livraison, les environnements nommés, les exemplaires. */
export function deployFacts(parts: DeployPart[], payload: DeployPayload): FactCard[] {
  const { pipelines } = payload.deploy;
  const running = parts.filter((p) => !["store", "channel", "managed"].includes(p.node.role));
  const manifests = [...new Set(parts.flatMap((p) => p.declared.map((d) => d.proof.path)))];
  const ships = deploySteps(pipelines);
  const envs = [...new Set(pipelines.flatMap((p) => p.jobs.flatMap((j) => (j.environment ? [j.environment.name] : []))))];
  const sized = parts.filter((p) => p.node.instances);
  const bare = parts.filter((p) => !p.declared.length);
  return [
    { question: "Ce qui tourne", answer: count(running.length, "partie"), detail: joinWords(running.map((p) => p.node.name)) },
    {
      question: "Fichiers qui les déclarent", answer: count(manifests.length, "fichier"), detail: manifests.join(", ") || "aucun fichier de déploiement lu",
      ...(bare.length ? { attention: true } : {}),
    },
    {
      question: "Chaîne de livraison", answer: pipelines.length ? `${count(pipelines.length, "workflow")} · ${count(ships.length, "déploiement")}` : "aucun workflow",
      detail: ships.length ? `${joinWords([...new Set(ships.map((x) => x.j.id))])} déploie` : pipelines.length ? "aucune étape ne déploie : la livraison n'est pas écrite dans les workflows" : "aucun workflow dans .github/workflows",
      attention: pipelines.length > 0 && !ships.length,
    },
    { question: "Environnements", answer: envs.length ? joinWords(envs) : "aucun nommé", detail: envs.length ? "nommés par les jobs des workflows" : "ni les workflows ni les manifestes lus n'en nomment" },
    {
      question: "Exemplaires", answer: sized.length ? sized.map((p) => `${p.node.name} ×${p.node.instances!.min}`).join(" · ") : "non écrits",
      detail: sized.length ? "le minimum écrit dans le manifeste" : "aucun manifeste ne dit combien en tournent",
    },
  ];
}

/** `À savoir` : ce qui manque, puis ce que VisionLayer ne voit pas. */
export function deployNotes(parts: DeployPart[], payload: DeployPayload): GlanceNote[] {
  const bare = parts.filter((p) => !p.declared.length);
  const envs = payload.deploy.pipelines.some((p) => p.jobs.some((j) => j.environment));
  return [
    ...bare.map((p) => ({ text: `${p.node.name} : aucun fichier de déploiement ne dit où il tourne`, tone: "attention" as const })),
    ...payload.deploy.pipelines.filter((p) => p.parseError).map((p) => ({ text: `${p.path} illisible : ${p.parseError}`, tone: "attention" as const })),
    ...(envs ? [{ text: "Les règles d'approbation d'un environnement sont réglées chez l'hébergeur du dépôt, pas dans le fichier", tone: "plain" as const }] : []),
    { text: "Seuls les workflows GitHub Actions sont lus aujourd'hui comme chaîne de livraison", tone: "plain" },
  ];
}
