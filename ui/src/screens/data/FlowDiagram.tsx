import type { ArchModelV2, TechLabel } from "../../api/types";
import { TechLogo } from "../../components/TechLogo";
import { primaryTechId } from "../../domain/architecture/describe";
import type { Lane, Lifecycle } from "../../domain/data/lifecycle";
import { Icon } from "../../shell/icons";
import { FlowStep } from "./FlowStep";
import styles from "./FlowDiagram.module.css";

const ROLE: Record<Lane["role"], string> = { caller: "appelle", queue: "dépose", writer: "écrit", entity: "ligne" };
const LANE_WIDTH = 88;

interface Props {
  life: Lifecycle;
  model: ArchModelV2;
  tech: Record<string, TechLabel>;
  version: string;
  selected: number;
  onSelect: (i: number) => void;
}

/** Un couloir par acteur ; chaque écriture, une ligne : qui la déclenche, qui l'écrit, et la ligne de la table. */
export function FlowDiagram({ life, model, tech, version, selected, onSelect }: Props) {
  const nodes = new Map(model.nodes.map((n) => [n.id, n]));
  const columns = { gridTemplateColumns: `minmax(280px, 1fr) ${life.lanes.length * LANE_WIDTH}px` };
  const mark = (lane: Lane) => {
    if (lane.role === "entity") return <Icon name="data" size={14} />;
    if (lane.role === "queue") return <Icon name="messages" size={14} />;
    if (lane.detail && lane.nodeId) return <Icon name="clock" size={14} />;
    const node = lane.nodeId ? nodes.get(lane.nodeId) : undefined;
    const id = node && primaryTechId(node, tech);
    return id ? <TechLogo id={id} label={tech[id]} size={14} bare /> : <Icon name="file" size={14} />;
  };
  return (
    <div className={styles.diagram}>
      <div className={styles.head} style={columns}>
        <span className={styles.pill}>écriture · valeur</span>
        <div className={styles.lanes} style={{ gridTemplateColumns: `repeat(${life.lanes.length}, 1fr)` }}>
          {life.lanes.map((l) => (
            <div key={l.id} className={styles.lane}>
              <span className={styles.mark}>{mark(l)}</span>
              <span className={styles.name}>{l.label}</span>
              <span className={styles.role}>{l.detail ?? ROLE[l.role]}</span>
            </div>
          ))}
        </div>
      </div>
      {life.steps.map((s, i) => (
        <FlowStep key={`${s.proof.path}:${s.proof.line}`} index={i} step={s} lanes={life.lanes} field={life.field.name} columns={columns}
          version={version} selected={i === selected} onSelect={() => onSelect(i === selected ? -1 : i)} />
      ))}
      <div className={styles.legend}>
        <span className={styles.pill}>flèches</span>
        <span className={styles.key}><i className={styles.keyCall} />appel, file ou horloge</span>
        <span className={styles.key}><i className={styles.keyWrite} />écriture de la ligne</span>
      </div>
    </div>
  );
}
