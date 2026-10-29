import { useState } from "react";
import type { ArchModelV2, Entity, Field, TechLabel } from "../../api/types";
import { lifecycle } from "../../domain/data/lifecycle";
import { count } from "../../domain/text/plural";
import { FlowDiagram } from "./FlowDiagram";
import { StatesStrip } from "./StatesStrip";
import styles from "./CycleView.module.css";

interface Props {
  entity: Entity;
  field: Field;
  model: ArchModelV2;
  tech: Record<string, TechLabel>;
  version: string;
}

/** Le cycle de vie d'un champ : ses états, puis chaque écriture, de qui la déclenche jusqu'à la ligne. */
export function CycleView({ entity, field, model, tech, version }: Props) {
  const life = lifecycle(entity, field, model);
  const [selected, setSelected] = useState(0);
  return (
    <div className={styles.view}>
      <div className={styles.heading}>
        <h2 className={styles.h2}>États de {field.name}</h2>
        <span className={styles.caption}>lus dans le schéma et dans les écritures de « {field.name} » · extrait du code</span>
      </div>
      <StatesStrip states={life.states} />
      <div className={styles.heading}>
        <h2 className={styles.h2}>Comment la donnée circule</h2>
        <span className={styles.caption}>{count(life.steps.length, "écriture")} de {field.name}, rangées par valeur</span>
      </div>
      <FlowDiagram life={life} model={model} tech={tech} version={version} selected={selected} onSelect={setSelected} />
      <p className={styles.note}>
        Chaque écriture est montrée là où le code la fait. L'état d'où elle part n'est pas encore lu : les conditions
        écrites dans le code (« si la réservation est déjà annulée ») restent à lire dans l'extrait.
      </p>
    </div>
  );
}
