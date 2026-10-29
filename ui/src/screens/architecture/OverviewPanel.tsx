import type { ArchModelV2, TechLabel } from "../../api/types";
import { screenHref } from "../../app/screens";
import { Pill } from "../../components/Pill";
import { ProofRef } from "../../components/ProofRef";
import { SidePanel } from "../../components/SidePanel";
import { TechLogo } from "../../components/TechLogo";
import { groupFindings } from "../../domain/architecture/findings";
import { implications } from "../../domain/architecture/implications";
import type { MapLink } from "../../domain/architecture/links";
import { count } from "../../domain/text/plural";
import styles from "./OverviewPanel.module.css";

interface Props {
  model: ArchModelV2;
  links: MapLink[];
  tech: Record<string, TechLabel>;
}

/** Sans bloc choisi : ce que cette architecture implique, puis ce qu'il faut vérifier, par nature. */
export function OverviewPanel({ model, links, tech }: Props) {
  const items = implications(model, links, tech, screenHref);
  const groups = groupFindings(model.findings);
  return (
    <SidePanel label="Ce que cette architecture implique">
      <Pill>Ce que cette architecture implique</Pill>
      <div className={styles.list}>
        {items.map((i) => (
          <article key={i.title} className={styles.item}>
            <div className={styles.head}>
              <b>{i.title}</b>
              {i.techs.length > 0 && <span className={styles.logos}>{[...new Set(i.techs)].map((t) => <TechLogo key={t} id={t} label={tech[t]} size={18} />)}</span>}
            </div>
            <p>{i.text}</p>
            {i.link && <a className={styles.link} href={i.link.href}>{i.link.label} →</a>}
          </article>
        ))}
      </div>
      <Pill>À vérifier · {model.findings.length}</Pill>
      <ul className={styles.checks}>
        {groups.map((g) => (
          <li key={g.code} title={g.findings[0]!.message}>
            <b className={styles.count}>{g.findings.length}</b>
            <span>{g.label.replace(/^\d+ /, "")}</span>
            {g.findings[0]!.proof[0] && <ProofRef proof={g.findings[0]!.proof[0]} />}
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        <b>Comment c'est lu</b>
        {count(links.length, "lien", "liens")} entre {count(new Set(links.flatMap((l) => [l.from, l.to])).size, "bloc", "blocs")}, chacun prouvé par une ligne de code ou de déploiement. Choisis un bloc pour voir les siens.
      </p>
    </SidePanel>
  );
}
