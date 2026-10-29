import type { ArchModelV2, Entity } from "../../api/types";
import { ProofRef } from "../../components/ProofRef";
import { writersOf, type StoreAccess } from "../../domain/data/actors";
import { constraintSentence, controlsOf } from "../../domain/data/controls";
import { writersSentence } from "../../domain/data/summary";
import { Icon } from "../../shell/icons";
import styles from "./TablePanel.module.css";

/** Ce que le code montre, à comparer au commentaire : qui écrit, et ce que la base refuse. */
export function TableVerdict({ entity, access, model }: { entity: Entity; access: StoreAccess; model: ArchModelV2 }) {
  const names = new Map(model.nodes.map((n) => [n.id, n.name]));
  const blocks = [...new Set(writersOf(access, entity.name).map((id) => access.actors.find((a) => a.id === id)?.nodeId ?? id))];
  const refs = (entity.constraints ?? []).filter((c) => c.kind === "foreign");
  return (
    <div className={styles.verdict}>
      <span className={styles.check}><Icon name="check" size={14} /></span>
      <div className={styles.lines}>
        <span>Lu dans le code : {writersSentence(blocks.map((id) => names.get(id) ?? id)).replace(/^./, (c) => c.toLowerCase())}</span>
        {controlsOf(entity).map((c) => <span key={c.proof.line}>La base refuse {constraintSentence(c)}. <ProofRef proof={c.proof} /></span>)}
        {!controlsOf(entity).length && <span className={styles.muted}>Aucune unicité ni vérification posée par la base : seul le code garde cette table.</span>}
        {refs.map((c) => <span key={c.fields.join()} className={styles.muted}>{c.fields.join(", ")} renvoie à {c.references}. <ProofRef proof={c.proof} /></span>)}
      </div>
    </div>
  );
}
