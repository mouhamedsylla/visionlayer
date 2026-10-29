import type { ArchModelV2, ArchNode, TechLabel } from "../../api/types";
import { screenHref } from "../../app/screens";
import { NodeLinks } from "../../components/NodeLinks";
import { ProofRef } from "../../components/ProofRef";
import { PanelBack, PanelItem, PanelSection, SidePanel } from "../../components/SidePanel";
import { findingsOf, groupFindings } from "../../domain/architecture/findings";
import { linkLabel, mapLinks, mapNodes } from "../../domain/architecture/links";
import { count } from "../../domain/text/plural";
import styles from "./BlockPanel.module.css";
import { TechText } from "../../components/TechText";

interface Props {
  node: ArchNode;
  model: ArchModelV2;
  tech: Record<string, TechLabel>;
}

/** Sans point d'entrée choisi : à qui le bloc parle, qui vient vers lui, d'où il est déployé, ce qu'il faut y vérifier. */
export function BlockPanel({ node, model, tech }: Props) {
  const links = mapLinks(model);
  const nodes = mapNodes(model);
  const env = node.facets.config?.env ?? [];
  const groups = groupFindings(findingsOf(node.id, model.findings));
  const manifests = node.proof.filter((p, i, all) => p.source === "manifest" && all.findIndex((q) => q.path === p.path) === i);
  return (
    <SidePanel label={`Le bloc ${node.name}`}>
      <PanelBack href={screenHref("architecture")}>← La carte du système</PanelBack>
      <NodeLinks title="Il va vers" links={links.filter((l) => l.from === node.id)} other={(l) => l.to} nodes={nodes} tech={tech} label={linkLabel} />
      <NodeLinks title="Vient vers lui" links={links.filter((l) => l.to === node.id)} other={(l) => l.from} nodes={nodes} tech={tech} label={linkLabel} />
      <PanelSection title="Déploiement">
        <ul className={styles.deploy}>
          {manifests.map((p) => <li key={p.path}><span>déclaré dans</span><ProofRef proof={p} /></li>)}
          {node.instances && <li><b>{node.instances.min}{node.instances.max ? `–${node.instances.max}` : ""}</b><span>exemplaires</span><ProofRef proof={node.instances.proof} /></li>}
          {env.length > 0 && <li><b>{env.length}</b><span>{env.length > 1 ? "variables d'environnement" : "variable d'environnement"}, noms seulement</span></li>}
        </ul>
      </PanelSection>
      <PanelSection title={`À vérifier · ${groups.reduce((n, g) => n + g.findings.length, 0)}`} empty="Rien de relevé sur ce bloc.">
        {groups.map((g) => (
          <PanelItem key={g.code} title={<><span className={styles.badge}>{g.findings.length}</span> {g.label.replace(/^\d+ /, "")}</>}>
            {g.findings.map((f, i) => <span key={i}><TechText text={f.message} /> {f.proof[0] && <ProofRef proof={f.proof[0]} />}</span>)}
          </PanelItem>
        ))}
      </PanelSection>
      <p className={styles.note}>{count(node.files?.length ?? 0, "fichier", "fichiers")} dans ce bloc, lus par imports depuis ce qu'il lance.</p>
    </SidePanel>
  );
}
