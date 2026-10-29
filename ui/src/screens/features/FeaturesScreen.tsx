import { useMemo } from "react";
import type { ScreenProps } from "../../app/ScreenProps";
import { BlockCounters } from "../block/BlockCounters";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StatusMessage } from "../../components/StatusMessage";
import { entryGroups, findEntry } from "../../domain/features/list";
import { FeatureList } from "./FeatureList";
import { FeaturesPanel } from "./FeaturesPanel";
import { TraceScreen } from "./TraceScreen";
import styles from "./FeaturesScreen.module.css";

/** `#/features` : les points d'entrée et ce qu'ils atteignent ; `#/features/<point d'entrée>` : son déroulé. */
export function FeaturesScreen({ project, map, params }: ScreenProps) {
  const { model } = map;
  const names = useMemo(() => new Map(model.nodes.map((n) => [n.id, n.name])), [model]);
  const groups = useMemo(() => entryGroups(model), [model]);
  if (params[0]) {
    const item = findEntry(model, params[0]);
    return item ? <TraceScreen project={project} map={map} item={item} names={names} tab={params[1]} />
      : <StatusMessage title="Point d'entrée introuvable" detail={`${params[0]} n'est pas sur la carte actuelle.`} />;
  }
  const total = groups.reduce((n, g) => n + g.entries.length, 0);
  return (
    <div className={styles.screen}>
      <ScreenHeader crumbs={[{ label: project.name }, { label: "Features" }]} title="Features"
        lead="Ce que le produit fait pour ses utilisateurs. Le nom et le but d'une feature sont déclarés par l'agent qui la construit ; ce qu'elle atteint est calculé depuis ses points d'entrée.">
        <BlockCounters counters={[
          { value: 0, label: "feature déclarée" },
          { value: total, label: total > 1 ? "points d'entrée sans feature" : "point d'entrée sans feature", attention: total > 0 },
          { value: 0, label: "règle ou invariant" },
        ]} />
      </ScreenHeader>
      <div className={styles.body}>
        <div className={styles.main}><FeatureList groups={groups} model={model} names={names} /></div>
        <FeaturesPanel groups={groups} />
      </div>
    </div>
  );
}
