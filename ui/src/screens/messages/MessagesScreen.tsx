import { useMemo, useState } from "react";
import type { ScreenProps } from "../../app/ScreenProps";
import { Pill } from "../../components/Pill";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StatusMessage } from "../../components/StatusMessage";
import { findEntry } from "../../domain/features/list";
import { backgroundFacts } from "../../domain/messages/facts";
import { backgroundEntries } from "../../domain/messages/triggers";
import { count } from "../../domain/text/plural";
import { FactsRow } from "../architecture/FactsRow";
import { DayTimeline } from "./DayTimeline";
import { JourneyScreen } from "./JourneyScreen";
import { TriggerPanel } from "./TriggerPanel";
import { TriggerTable } from "./TriggerTable";
import styles from "./MessagesScreen.module.css";

/** `#/messages` : ce qui tourne sans que personne clique (maquette 42) ; `#/messages/<point d'entrée>` : son trajet (maquette 28). */
export function MessagesScreen({ project, map, params }: ScreenProps) {
  const { model } = map;
  const names = useMemo(() => new Map(model.nodes.map((n) => [n.id, n.name])), [model]);
  const entries = useMemo(() => backgroundEntries(model), [model]);
  const [selected, setSelected] = useState(entries[0]?.entry.id);
  if (params[0]) {
    const item = findEntry(model, params[0]);
    return item ? <JourneyScreen project={project} map={map} item={item} names={names} tab={params[1]} />
      : <StatusMessage title="Déclencheur introuvable" detail={`${params[0]} n'est pas sur la carte actuelle.`} />;
  }
  const item = entries.find((x) => x.entry.id === selected) ?? entries[0];
  return (
    <div className={styles.screen}>
      <ScreenHeader crumbs={[{ label: project.name }, { label: "Messages" }, { label: "Sans clic" }]} title="Ce qui tourne sans que personne clique"
        lead="Tâches planifiées, files écoutées, événements reçus d'un service externe. Lu dans le code et le déploiement, sans agent.">
        <FactsRow facts={backgroundFacts(entries, model, names)} tech={map.tech} />
      </ScreenHeader>
      <div className={styles.body}>
        <div className={styles.main}>
          {entries.length ? (
            <>
              <section className={styles.box}>
                <h2 className={styles.heading}><Pill>Une journée</Pill>ce qui se lance sans que personne clique</h2>
                <DayTimeline entries={entries} model={model} names={names} selected={item?.entry.id} onSelect={setSelected} />
              </section>
              <section className={styles.box}>
                <h2 className={styles.heading}><Pill>{count(entries.length, "déclencheur")}</Pill>lus dans le code</h2>
                <TriggerTable entries={entries} model={model} names={names} selected={item?.entry.id} onSelect={setSelected} />
              </section>
            </>
          ) : <p className={styles.empty}>Aucune tâche planifiée, file écoutée ni route appelée par un service externe n'est reconnue dans ce dépôt.</p>}
        </div>
        {item && <TriggerPanel item={item} entries={entries} map={map} names={names} />}
      </div>
    </div>
  );
}
