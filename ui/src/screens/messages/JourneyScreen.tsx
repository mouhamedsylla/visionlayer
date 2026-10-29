import type { MapPayload, ProjectInfo } from "../../api/types";
import { screenHref } from "../../app/screens";
import { ScreenHeader } from "../../components/ScreenHeader";
import { ViewTabs } from "../../components/ViewTabs";
import { entryNature } from "../../domain/block/entries";
import type { EntryRef } from "../../domain/features/list";
import { traceFailures } from "../../domain/features/trace";
import { journeyTitle, sendersOf, whenLabel } from "../../domain/messages/triggers";
import { count } from "../../domain/text/plural";
import { sentence } from "../../domain/text/sentence";
import { FailureTable } from "../features/FailureTable";
import { HandlerCode } from "../features/HandlerCode";
import { SequenceView } from "../features/SequenceView";
import { TraceLegend } from "../features/TraceLegend";
import { JourneyPanel } from "./JourneyPanel";
import styles from "./JourneyScreen.module.css";
import { TechText } from "../../components/TechText";

interface Props {
  project: ProjectInfo;
  map: MapPayload;
  item: EntryRef;
  names: Map<string, string>;
  tab?: string;
}

/** Le trajet d'un déclencheur sans clic (maquette 28) : qui l'envoie, chaque étape de son code en couloirs, et ce qu'il lit autour. */
export function JourneyScreen({ project, map, item, names, tab }: Props) {
  const { entry } = item;
  const name = entry.handler?.name ?? entry.key;
  const current = tab === "code" ? "code" : "trajet";
  const steps = entry.flow ?? [];
  const senders = sendersOf(entry, map.model, names);
  return (
    <div className={styles.screen}>
      <ScreenHeader
        crumbs={[{ label: project.name }, { label: "Messages", href: screenHref("messages") }, { label: name }]}
        title={name}
        lead={
          <span className={styles.lead}>
            <span className={styles.nature}>{entryNature(entry)}</span>
            {senders.length > 0 && <span>{senders.join(", ")} →</span>}
            <span className={styles.key}>{entry.key}</span>
            <span>· <TechText text={sentence(whenLabel(entry, map.model, names))} /></span>
          </span>
        }
        aside={<ViewTabs label="Vues du déclencheur" current={current} href={(id) => screenHref("messages", entry.id, ...(id === "code" ? ["code"] : []))}
          tabs={[{ id: "trajet", label: "Comment ça marche", icon: "messages", count: steps.length }, { id: "code", label: "Code", icon: "code" }]} />}
      />
      <div className={styles.body}>
        <div className={styles.main}>
          {current === "trajet" && (steps.length ? (
            <>
              <h2 className={styles.title}>{journeyTitle(entry, senders)}<span className={styles.count}>{count(steps.length, "étape")}</span></h2>
              <SequenceView item={item} map={map} names={names} />
              <FailureTable failures={traceFailures(item, map.model)} />
              <TraceLegend />
            </>
          ) : <p className={styles.empty}>Aucune étape lue : son code ne lit, n'écrit, n'appelle et ne refuse rien que le moteur reconnaisse.</p>)}
          {current === "code" && <HandlerCode entry={entry} version={map.builtAt} />}
        </div>
        <JourneyPanel item={item} model={map.model} names={names} />
      </div>
    </div>
  );
}
