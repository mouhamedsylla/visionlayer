import type { MapPayload, ProjectInfo } from "../../api/types";
import { screenHref } from "../../app/screens";
import { ProofRef } from "../../components/ProofRef";
import { ScreenHeader } from "../../components/ScreenHeader";
import { ViewTabs } from "../../components/ViewTabs";
import { entryGroups, type EntryRef } from "../../domain/features/list";
import { traceFailures } from "../../domain/features/trace";
import { FailureTable } from "./FailureTable";
import { HandlerCode } from "./HandlerCode";
import { SequenceView } from "./SequenceView";
import { TraceChips } from "./TraceChips";
import { TraceLegend } from "./TraceLegend";
import styles from "./TraceScreen.module.css";

interface Props {
  project: ProjectInfo;
  map: MapPayload;
  item: EntryRef;
  names: Map<string, string>;
  tab?: string;
}

/** Le déroulé tracé d'un point d'entrée (maquette 07) : en couloirs, puis ce qui se passe si ça rate. `#/features/<point d'entrée>/code`. */
export function TraceScreen({ project, map, item, names, tab }: Props) {
  const { entry } = item;
  const group = entryGroups(map.model).find((g) => g.entries.some((x) => x.entry.id === entry.id));
  const current = tab === "code" ? "code" : "trace";
  const callers = map.model.edges.filter((e) => e.target?.entrypoint === entry.id);
  const steps = entry.flow ?? [];
  return (
    <div className={styles.screen}>
      <ScreenHeader
        crumbs={[{ label: project.name }, { label: "Features", href: screenHref("features") }, ...(group ? [{ label: group.title }] : []), { label: entry.handler?.name ?? entry.key }]}
        title={entry.handler?.name ?? entry.key}
        lead={<TraceChips item={item} names={names} />}
        aside={<ViewTabs label="Vues du point d'entrée" current={current} href={(id) => screenHref("features", entry.id, ...(id === "code" ? ["code"] : []))}
          tabs={[{ id: "trace", label: "Tracé", icon: "features", count: steps.length }, { id: "code", label: "Code", icon: "code" }]} />}
      />
      <div className={styles.body}>
        {callers.length > 0 && (
          <p className={styles.callers}>
            {callers.map((c, i) => (
              <span key={c.id}>{i > 0 && " · "}Appelée par {names.get(c.from) ?? c.from} · <ProofRef proof={c.occurrences[0]!} /></span>
            ))}
          </p>
        )}
        {current === "trace" && (steps.length ? (
          <>
            <SequenceView item={item} map={map} names={names} />
            <FailureTable failures={traceFailures(item, map.model)} />
            <TraceLegend />
          </>
        ) : <p className={styles.callers}>Aucune étape lue : la fonction de ce point d'entrée ne lit, n'écrit, n'appelle et ne refuse rien que le moteur reconnaisse.</p>)}
        {current === "code" && <HandlerCode entry={entry} version={map.builtAt} />}
      </div>
    </div>
  );
}
