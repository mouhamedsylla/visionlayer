import { useMemo } from "react";
import type { ScreenProps } from "../../app/ScreenProps";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StatusMessage } from "../../components/StatusMessage";
import { allFunctions, findFunction } from "../../domain/code/functions";
import { CodePanel } from "./CodePanel";
import { FunctionList } from "./FunctionList";
import { FunctionScreen } from "./FunctionScreen";
import styles from "./CodeScreen.module.css";

/** `#/code` : les fonctions du dépôt, par bloc et par fichier ; `#/code/<fichier:ligne>` : une fonction et sa preuve. */
export function CodeScreen({ project, map, params }: ScreenProps) {
  const { model } = map;
  const names = useMemo(() => new Map(model.nodes.map((n) => [n.id, n.name])), [model]);
  if (params[0]) {
    const item = findFunction(model, params[0]);
    return item ? <FunctionScreen project={project} map={map} item={item} names={names} />
      : <StatusMessage title="Fonction introuvable" detail={`${params[0]} n'est pas sur la carte actuelle.`} />;
  }
  const empty = allFunctions(model).length === 0;
  return (
    <div className={styles.screen}>
      <ScreenHeader crumbs={[{ label: project.name }, { label: "Code" }]} title="Code"
        lead="Chaque fonction du dépôt ouverte comme un point d'entrée : ce que fait son code, étape par étape, qui l'appelle et ce qu'elle appelle. En lecture seule, chaque fait renvoie à sa ligne." />
      <div className={styles.body}>
        <div className={styles.main}>
          {empty ? <p className={styles.none}>Aucune fonction lue : le moteur lit aujourd'hui les fichiers JavaScript et TypeScript des déployables.</p>
            : <FunctionList model={model} tech={map.tech} />}
        </div>
        <CodePanel model={model} />
      </div>
    </div>
  );
}
