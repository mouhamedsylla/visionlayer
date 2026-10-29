import { useMemo, useState } from "react";
import type { ScreenProps } from "../../app/ScreenProps";
import { pointRows } from "../../domain/overview/points";
import { AgentsCard } from "./AgentsCard";
import { ChangesCard } from "./ChangesCard";
import { KnowSection, type KnowTab } from "./KnowSection";
import { OverviewHero } from "./OverviewHero";
import { WorkflowSection } from "./WorkflowSection";
import styles from "./OverviewScreen.module.css";

/** La Vue d'ensemble : le système tel qu'il tourne, ce qui est en cours, ce qu'il faut savoir, ce qui a changé. */
export function OverviewScreen({ project, map }: ScreenProps) {
  const rows = useMemo(() => pointRows(map.model.findings), [map.model.findings]);
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<KnowTab>("points");
  const marked = tab === "points" ? rows[selected]?.nodes ?? [] : [];
  return (
    <div className={styles.screen}>
      <OverviewHero project={project} map={map} marked={marked} />
      <WorkflowSection />
      <KnowSection map={map} rows={rows} selected={Math.min(selected, Math.max(rows.length - 1, 0))} onSelect={setSelected} tab={tab} onTab={setTab} />
      <section className={styles.cards}>
        <ChangesCard map={map} />
        <AgentsCard />
      </section>
    </div>
  );
}
