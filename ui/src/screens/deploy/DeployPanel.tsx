import type { TechLabel } from "../../api/types";
import { screenHref } from "../../app/screens";
import { PanelAction, PanelNote, PanelSection, PanelTitle, SidePanel } from "../../components/SidePanel";
import { kindLabel } from "../../domain/architecture/describe";
import type { DeployPart } from "../../domain/deploy/parts";
import { joinWords } from "../../domain/text/plural";
import { TechRows } from "../technologies/TechRows";

/** Une partie ouverte : ce qui la déclare, combien et où, ce qui la livre ; sans manifeste, ce que le code en dit, sans rien inventer. */
export function DeployPanel({ part, tech }: { part: DeployPart; tech: Record<string, TechLabel> }) {
  const { node, declared, seenIn, readVia, shippedBy } = part;
  const facts = [
    ...(node.instances ? [{ label: `au moins ${node.instances.min} exemplaires`, proof: node.instances.proof }] : []),
    ...(node.attributes ?? []).map((a) => ({ label: `${a.key === "region" ? "région" : a.key} ${a.value}`, proof: a.proof })),
  ];
  const platforms = joinWords([...new Set(declared.map((d) => d.name))]);
  return (
    <SidePanel label={`Déploiement de ${node.name}`}>
      <PanelTitle kind={kindLabel(node, tech)} title={node.name} />
      {declared.length ? (
        <PanelSection title={`Ce qui le déclare · ${declared.length}`}>
          {declared.map((d) => <TechRows key={`${d.pack}-${d.proof.path}`} label={d.name} where={`${d.proof.path}:${d.proof.line}`} proof={d.proof} />)}
        </PanelSection>
      ) : (
        <PanelSection title="Où tourne-t-il ?">
          <PanelNote>
            Aucun fichier de déploiement du dépôt ne dit où {node.name} tourne. {readVia.length > 0 && <>Le code le joint par {joinWords(readVia.map((r) => r.name))}, dont la valeur n'est jamais lue. </>}
            VisionLayer n'invente pas de réponse.
          </PanelNote>
          {seenIn.map((d) => <TechRows key={`${d.pack}-${d.proof.path}`} label={`trouvé par : ${d.name.toLowerCase()}`} where={`${d.proof.path}:${d.proof.line}`} proof={d.proof} />)}
          {readVia.map((r) => <TechRows key={r.name} label={`joint par ${r.name}`} where={`${r.proof.path}:${r.proof.line}`} proof={r.proof} />)}
        </PanelSection>
      )}
      {facts.length > 0 && (
        <PanelSection title={`Combien et où · ${facts.length}`}>
          {facts.map((f) => <TechRows key={f.label} label={f.label} where={`${f.proof.path}:${f.proof.line}`} proof={f.proof} />)}
        </PanelSection>
      )}
      {declared.length > 0 && (
        <PanelSection title={`Livré par · ${shippedBy.length}`} empty={`Aucune étape de workflow ne déploie vers ${platforms}  : aucune livraison n'est écrite dans les workflows du dépôt.`}>
          {shippedBy.map(({ pipeline, job, step }) => (
            <TechRows key={`${pipeline.path}-${step.line}`} label={`${pipeline.name} › ${job.id}${job.environment ? ` · environnement ${job.environment.name}` : ""}`}
              code={step.command} where={`${pipeline.path}:${step.line}`} proof={{ path: pipeline.path, line: step.line }} />
          ))}
        </PanelSection>
      )}
      <PanelSection title="Ce que VisionLayer lit" open={false}>
        <PanelNote>
          Les fichiers de déploiement du dépôt ({declared.map((d) => d.proof.path).join(", ") || "aucun pour cette partie"}) et les workflows GitHub Actions.
          Il ne se connecte à aucun hébergeur, ne lance rien et ne lit aucun secret : un secret cité par un workflow n'est connu que par son nom.
          Une approbation avant la production se règle chez l'hébergeur du dépôt : VisionLayer ne la voit pas et ne la donne jamais.
        </PanelNote>
      </PanelSection>
      <PanelAction href={screenHref("architecture", node.id)}>Voir le bloc sur la carte →</PanelAction>
    </SidePanel>
  );
}
