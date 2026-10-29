import type { ArchNode, Finding, TechLabel } from "../../api/types";
import { screenHref } from "../../app/screens";
import { ProofRef } from "../../components/ProofRef";
import { PanelAction, PanelBack, SidePanel } from "../../components/SidePanel";
import { TechLogo } from "../../components/TechLogo";
import { contentBadges, kindLabel, originLabel, primaryTechId } from "../../domain/architecture/describe";
import { groupFindings } from "../../domain/architecture/findings";
import { linkLabel, linksOf, type MapLink } from "../../domain/architecture/links";
import { NodeLinks } from "../../components/NodeLinks";
import styles from "./NodePanel.module.css";
import { TechText } from "../../components/TechText";

interface Props {
  node: ArchNode;
  nodes: ArchNode[];
  links: MapLink[];
  findings: Finding[];
  tech: Record<string, TechLabel>;
  onClose: () => void;
}

/** Le bloc choisi : ce qu'il est, ce qu'il emploie, à qui il parle dans chaque sens, ce qu'il faut y vérifier. */
export function NodePanel({ node, nodes, links, findings, tech, onClose }: Props) {
  const own = linksOf(node.id, links);
  const groups = groupFindings(findings.filter((f) => f.nodes?.includes(node.id)));
  const main = primaryTechId(node, tech) ?? node.tech?.[0];
  return (
    <SidePanel label={node.name}>
      <PanelBack onClick={onClose}>← Tout le système</PanelBack>
      <header className={styles.head}>
        {main && <TechLogo id={main} label={tech[main]} size={40} />}
        <div>
          <span className={styles.kind}>{kindLabel(node, tech)}</span>
          <h2 className={styles.name}>{node.name}</h2>
          {originLabel(node) && <span className={styles.kind}>{originLabel(node)}</span>}
        </div>
      </header>
      {contentBadges(node).length > 0 && (
        <ul className={styles.counts}>{contentBadges(node).map((b) => <li key={b}><b>{b.split(" ")[0]}</b>{b.split(" ").slice(1).join(" ")}</li>)}</ul>
      )}
      {(node.tech?.length ?? 0) > 0 && (
        <section>
          <h3 className={styles.heading}>Emploie</h3>
          <ul className={styles.techs}>
            {node.tech!.map((t) => <li key={t}><TechLogo id={t} label={tech[t]} size={18} />{tech[t]?.name ?? t}</li>)}
          </ul>
        </section>
      )}
      <PanelAction href={screenHref("architecture", node.id)}>Entrer dans le bloc →</PanelAction>
      <NodeLinks title="Il va vers" links={own.filter((l) => l.from === node.id)} other={(l) => l.to} nodes={nodes} tech={tech} label={linkLabel} />
      <NodeLinks title="Vient vers lui" links={own.filter((l) => l.to === node.id)} other={(l) => l.from} nodes={nodes} tech={tech} label={linkLabel} />
      <section>
        <h3 className={styles.heading}>À vérifier · {groups.reduce((n, g) => n + g.findings.length, 0)}</h3>
        {groups.length === 0 && <p className={styles.empty}>Rien de relevé sur ce bloc.</p>}
        {groups.map((g) => (
          <div key={g.code} className={styles.check}>
            <b className={styles.badge}>{g.findings.length}</b>
            <div>
              <span className={styles.checkTitle}>{g.label.replace(/^\d+ /, "")}</span>
              {g.findings.map((f, i) => <span key={i} className={styles.checkLine}><TechText text={f.message} /> {f.proof[0] && <ProofRef proof={f.proof[0]} />}</span>)}
            </div>
          </div>
        ))}
      </section>
    </SidePanel>
  );
}
