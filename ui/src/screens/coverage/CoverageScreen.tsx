import { useMemo } from "react";
import type { ScreenProps } from "../../app/ScreenProps";
import { useKnowledge } from "../../api/useKnowledge";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StatusMessage } from "../../components/StatusMessage";
import { coverageFacts } from "../../domain/coverage/facts";
import { coverageGaps } from "../../domain/coverage/gaps";
import { measure, partCovers } from "../../domain/coverage/measure";
import { FactsRow } from "../architecture/FactsRow";
import { CoveragePanel } from "./CoveragePanel";
import { GapList } from "./GapList";
import { PartTable } from "./PartTable";
import styles from "./CoverageScreen.module.css";

/** `#/couverture` : ce qu'on sait du système, et ce qu'il manque, recalculé à chaque nouvelle carte. */
export function CoverageScreen({ project, map }: ScreenProps) {
  const state = useKnowledge(map.builtAt);
  const payload = state.status === "ready" ? state.payload : undefined;
  const m = useMemo(() => (payload ? measure(map.model, payload.report) : undefined), [payload, map.model]);
  if (state.status === "error") return <StatusMessage title="Couverture incalculable" detail={state.message} />;
  if (state.status === "loading" || !m) return <StatusMessage title="Calcul de la couverture" detail="Notes déclarées, points d'entrée, refus et tables de la carte." />;
  return (
    <div className={styles.screen}>
      <ScreenHeader crumbs={[{ label: project.name }, { label: "Couverture" }]} title="Ce qu'on sait, et ce qu'il manque"
        lead="Recalculé à chaque mise à jour de la carte : ce que le code permet de rattacher et d'expliquer, et l'état des notes déclarées contre le code d'aujourd'hui.">
        <FactsRow facts={coverageFacts(map.model, m, state.payload)} tech={map.tech} />
      </ScreenHeader>
      <div className={styles.body}>
        <div className={styles.main}>
          <PartTable parts={partCovers(map.model, m)} tech={map.tech} />
          <GapList gaps={coverageGaps(map.model, m)} />
        </div>
        <CoveragePanel claims={m.claims} payload={state.payload} />
      </div>
    </div>
  );
}
