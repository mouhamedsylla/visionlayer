import { useMemo } from "react";
import type { ScreenProps } from "../../app/ScreenProps";
import { useStack } from "../../api/useStack";
import { Glance } from "../../components/Glance";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StatusMessage } from "../../components/StatusMessage";
import { techFacts, techNotes } from "../../domain/technologies/facts";
import { busiestExternal, externalTechIds, techGroups } from "../../domain/technologies/groups";
import { FactsRow } from "../architecture/FactsRow";
import { TechGroupBox } from "./TechGroupBox";
import { TechPanel } from "./TechPanel";
import styles from "./TechnologiesScreen.module.css";

/** `#/technologies` : ce avec quoi le système est fait, lu dans ses manifestes et sa configuration ; `#/technologies/<id>` ouvre une technologie. */
export function TechnologiesScreen({ project, map, params }: ScreenProps) {
  const state = useStack(map.builtAt);
  const payload = state.status === "ready" ? state.payload : undefined;
  const groups = useMemo(() => (payload ? techGroups(payload.stack, map.model) : []), [payload, map.model]);
  if (state.status === "loading") return <StatusMessage title="Lecture des technologies" detail="Manifestes, fichiers de configuration et images de conteneur." />;
  if (state.status === "error") return <StatusMessage title="Technologies illisibles" detail={state.message} />;
  const { stack, tech } = state.payload;
  const external = externalTechIds(map.model);
  const tiles = groups.flatMap((g) => g.tiles);
  const id = params[0] ?? busiestExternal(map.model) ?? tiles[0]?.id;
  const current = stack.technologies.find((t) => t.id === id);
  return (
    <div className={styles.screen}>
      <ScreenHeader crumbs={[{ label: project.name }, { label: "Technologies" }]} title="Ce avec quoi le système est fait"
        lead="Lu dans les manifestes, les fichiers de configuration et les images de conteneur, sans agent. Chaque technologie renvoie à la ligne qui la déclare."
        aside={<Glance notes={techNotes(stack)} />}>
        <FactsRow facts={techFacts(stack, map.model)} tech={tech} />
      </ScreenHeader>
      <div className={styles.body}>
        <div className={styles.main}>
          {groups.length ? groups.map((g) => <TechGroupBox key={g.title} group={g} tech={tech} current={current?.id} />)
            : <p className={styles.none}>Aucune technologie trouvée : ni manifeste, ni fichier de configuration reconnu.</p>}
        </div>
        {current && <TechPanel t={current} tech={tech} model={map.model} external={external.has(current.id)} />}
      </div>
    </div>
  );
}
