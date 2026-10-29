import { useMemo } from "react";
import type { ScreenProps } from "../../app/ScreenProps";
import { useDeploy } from "../../api/useDeploy";
import { Glance } from "../../components/Glance";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StatusMessage } from "../../components/StatusMessage";
import { deployFacts, deployNotes } from "../../domain/deploy/facts";
import { deployParts } from "../../domain/deploy/parts";
import { FactsRow } from "../architecture/FactsRow";
import { DeployPanel } from "./DeployPanel";
import { PartRow } from "./PartRow";
import { PipelineView } from "./PipelineView";
import styles from "./DeployScreen.module.css";

/** `#/deploiement` : où le système tourne et comment il y arrive, lu dans les manifestes et les workflows ; `#/deploiement/<bloc>` ouvre une partie. */
export function DeployScreen({ project, map, params }: ScreenProps) {
  const state = useDeploy(map.builtAt);
  const payload = state.status === "ready" ? state.payload : undefined;
  const parts = useMemo(() => (payload ? deployParts(map.model, payload) : []), [payload, map.model]);
  if (state.status === "loading") return <StatusMessage title="Lecture du déploiement" detail="Manifestes de déploiement et workflows du dépôt." />;
  if (state.status === "error") return <StatusMessage title="Déploiement illisible" detail={state.message} />;
  const { deploy, tech } = state.payload;
  const labels = { ...map.tech, ...tech };
  const current = parts.find((p) => p.node.id === params[0]) ?? parts.find((p) => !p.declared.length) ?? parts[0];
  return (
    <div className={styles.screen}>
      <ScreenHeader crumbs={[{ label: project.name }, { label: "Déploiement" }]} title="Où le système tourne, et comment il y arrive"
        lead="Lu dans les fichiers de déploiement et les workflows du dépôt, sans rien lancer. VisionLayer ne se connecte à aucun hébergeur et ne lit aucun secret."
        aside={<Glance notes={deployNotes(parts, state.payload)} />}>
        <FactsRow facts={deployFacts(parts, state.payload)} tech={labels} />
      </ScreenHeader>
      <div className={styles.body}>
        <div className={styles.main}>
          <section className={styles.section} aria-label="Du commit à la production">
            <h2 className={styles.title}>Du commit à la production</h2>
            {deploy.pipelines.length ? deploy.pipelines.map((p) => <PipelineView key={p.path} pipeline={p} tech={labels} />)
              : <p className={styles.none}>Aucun workflow dans <code>.github/workflows</code> : le dépôt ne dit pas comment le code est livré.</p>}
          </section>
          <section className={styles.section} aria-label="Où tourne chaque partie">
            <h2 className={styles.title}>Où tourne chaque partie</h2>
            <div className={styles.parts}>
              {parts.map((p) => <PartRow key={p.node.id} part={p} tech={labels} on={p.node.id === current?.node.id} />)}
            </div>
          </section>
        </div>
        {current && <DeployPanel part={current} tech={labels} />}
      </div>
    </div>
  );
}
