import type { ArchModelV2, TechLabel, Technology } from "../../api/types";
import { screenHref } from "../../app/screens";
import { PanelCard } from "../../components/panel/PanelCard";
import { PanelStats } from "../../components/panel/PanelStats";
import { PanelVars } from "../../components/panel/PanelVars";
import { PanelNote, PanelSection, SidePanel } from "../../components/SidePanel";
import { TechLogo } from "../../components/TechLogo";
import { kindLabel, primaryTechId } from "../../domain/architecture/describe";
import { techDetail } from "../../domain/technologies/detail";
import { categoryLabel, mainEvidence } from "../../domain/technologies/groups";
import { count, joinWords } from "../../domain/text/plural";
import { TechRows } from "./TechRows";
import styles from "./TechPanel.module.css";

interface Props {
  t: Technology;
  tech: Record<string, TechLabel>;
  model: ArchModelV2;
  external: boolean;
}

/** Une technologie ouverte : où elle est déclarée, quels blocs la portent ou l'appellent, les variables lues près d'elle, qui l'importe. */
export function TechPanel({ t, tech, model, external }: Props) {
  const d = techDetail(t, model);
  const first = d.declared[t.evidence.indexOf(mainEvidence(t)!)] ?? d.declared[0];
  const used = d.blocks.length ? `${external ? "Appelé par" : "Portée par"} ${joinWords(d.blocks.map((b) => b.name))} sur la carte.` : "Aucun bloc de la carte ne la porte.";
  return (
    <SidePanel label={t.name}>
      <div className={styles.head}>
        <TechLogo id={t.id} label={tech[t.id]} size={34} />
        <span className={styles.title}>
          <span className={styles.kind}>{categoryLabel(t, external)}</span>
          <b className={styles.name}>{t.name}</b>
        </span>
      </div>
      <p className={styles.lead}>
        {first && <>Déclarée dans <span className={styles.mono}>{first.where}</span>. </>}
        {t.versions.length > 0 && <>{t.versions.length > 1 ? "Versions lues" : "Version lue"} : <span className={styles.mono}>{t.versions.join(" · ")}</span>. </>}
        {used}
      </p>
      <PanelStats items={[
        { n: d.declared.length, label: d.declared.length > 1 ? "preuves" : "preuve" },
        { n: d.importers.length, label: "fichiers l'importent" },
        ...(external ? [{ n: d.calls.length, label: d.calls.length > 1 ? "appels" : "appel" }] : [{ n: d.blocks.length, label: d.blocks.length > 1 ? "blocs" : "bloc" }]),
      ]} />
      <PanelSection title={`Où elle est déclarée · ${d.declared.length}`}>
        {d.declared.map((x, i) => <TechRows key={i} label={x.label} where={x.where} proof={x.proof} />)}
      </PanelSection>
      {external && (
        <PanelSection title={`Où il est appelé · ${d.calls.length}`} empty="Aucune ligne de la carte ne l'appelle.">
          {d.calls.map(({ occurrence, from }, i) => <TechRows key={i} label={from} code={occurrence.text} where={`${occurrence.path}:${occurrence.line}`} proof={occurrence} />)}
        </PanelSection>
      )}
      <PanelSection title={`${external ? "Blocs qui l'appellent" : "Blocs qui la portent"} · ${d.blocks.length}`} empty="Aucun bloc de la carte.">
        {d.blocks.map((b) => {
          const logo = primaryTechId(b, tech);
          return <PanelCard key={b.id} mark={logo ? <TechLogo id={logo} label={tech[logo]} size={24} /> : undefined} kind={kindLabel(b, tech)} title={b.name} href={screenHref("architecture", b.id)} />;
        })}
      </PanelSection>
      {d.vars.length > 0 && (
        <PanelSection title={`Variables lues près d'elle · ${d.vars.length}`}>
          <PanelVars vars={d.vars} />
        </PanelSection>
      )}
      <PanelSection title={`Fichiers qui l'importent · ${d.importers.length}`} empty="Aucun fichier lu ne l'importe." open={d.importers.length <= 8}>
        {d.importers.map((f) => <TechRows key={f} where={f} />)}
      </PanelSection>
      <PanelSection title="Comment c'est lu" open={false}>
        <PanelNote>
          {count(d.declared.length, "preuve")} dans les manifestes, la configuration, les images de conteneur ou les fichiers du dépôt. Le catalogue ne fait que nommer :
          un paquet qu'il ne connaît pas reste listé sous son propre nom. Les variables sont celles lues dans les fichiers qui l'importent ou l'appellent, jamais leur valeur.
        </PanelNote>
      </PanelSection>
    </SidePanel>
  );
}
