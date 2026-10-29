import type { ArchModelV2, ArchNode, TechLabel } from "../../api/types";
import { screenHref } from "../../app/screens";
import { PanelCard } from "../../components/panel/PanelCard";
import { PanelStats } from "../../components/panel/PanelStats";
import { ProofRef } from "../../components/ProofRef";
import { PanelItem, PanelNote, PanelSection, PanelTitle, SidePanel } from "../../components/SidePanel";
import { TechLogo } from "../../components/TechLogo";
import { TechMark, TechText } from "../../components/TechText";
import { kindLabel, primaryTechId } from "../../domain/architecture/describe";
import { blockUse, type StoreAccess } from "../../domain/data/actors";
import { storeFindings } from "../../domain/data/findings";
import { count } from "../../domain/text/plural";
import { Icon } from "../../shell/icons";

interface Props {
  store: ArchNode;
  word: string;
  access: StoreAccess;
  model: ArchModelV2;
  tech: Record<string, TechLabel>;
}

/** Sans table choisie : le stockage en chiffres, les blocs qui l'ouvrent avec ce qu'ils y font, d'où il est déclaré, ce qu'il faut y vérifier. */
export function StorePanel({ store, word, access, model, tech }: Props) {
  const nodes = new Map(model.nodes.map((n) => [n.id, n]));
  const blocks = [...new Set(access.actors.map((a) => a.nodeId))];
  const points = storeFindings(store, model);
  const entities = store.facets.data?.entities.length ?? 0;
  const stats = [
    { n: entities, label: entities > 1 ? `${word}s` : word },
    { n: blocks.length, label: blocks.length > 1 ? "blocs l'ouvrent" : "bloc l'ouvre" },
    { n: points.length, label: "à vérifier" },
  ];
  return (
    <SidePanel label={store.name}>
      <PanelTitle kind={(store.tech ?? []).map((t) => tech[t]?.name ?? t).join(", ") || "stockage"} title={store.name} />
      <PanelStats items={stats} />
      <PanelNote>Choisir une {word} montre sa déclaration, ce que la base refuse, et chaque ligne qui la lit ou l'écrit.</PanelNote>
      <PanelSection title={`Ouvert par · ${blocks.length}`} empty="Aucun bloc ne lit ni n'écrit ce stockage dans le code lu.">
        {blocks.map((id) => {
          const node = nodes.get(id);
          const logo = node && (primaryTechId(node, tech) ?? node.tech?.[0]);
          const use = blockUse(access, id);
          const chips = [
            use.read > 0 && <><Icon name="read" size={11} />lit {count(use.read, word, `${word}s`)}</>,
            use.write > 0 && <><Icon name="write" size={11} />écrit {count(use.write, word, `${word}s`)}</>,
          ].filter(Boolean);
          return (
            <PanelCard key={id} mark={logo ? <TechLogo id={logo} label={tech[logo]} size={28} /> : undefined}
              kind={node ? kindLabel(node, tech) : undefined} title={node?.name ?? id} href={screenHref("architecture", id)} chips={chips}>
              {access.actors.filter((a) => a.nodeId === id && a.detail).map((a) => <span key={a.id}><Icon name="clock" size={11} /><span><TechMark piece={{ text: a.label, kind: "code" }} /> tâche planifiée, {a.detail}</span></span>)}
            </PanelCard>
          );
        })}
      </PanelSection>
      <PanelSection title="Déclaré à">
        {store.proof.map((p) => <PanelItem key={`${p.path}:${p.line}`}><span>{p.source === "manifest" ? "déploiement" : "connexion dans le code"}</span><ProofRef proof={p} /></PanelItem>)}
      </PanelSection>
      <PanelSection title={`À vérifier · ${points.length}`} empty="Rien de relevé sur le stockage lui-même.">
        {points.map((f, i) => <PanelItem key={`${f.code}-${i}`}><span><TechText text={f.message} /></span>{f.proof[0] && <ProofRef proof={f.proof[0]} />}</PanelItem>)}
      </PanelSection>
    </SidePanel>
  );
}
