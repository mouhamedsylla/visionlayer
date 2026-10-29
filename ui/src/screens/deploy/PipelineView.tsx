import type { Pipeline, TechLabel } from "../../api/types";
import { ProofRef } from "../../components/ProofRef";
import { jobColumns } from "../../domain/deploy/chain";
import { JobCard } from "./JobCard";
import styles from "./PipelineView.module.css";

/** Un workflow : ce qui le déclenche, puis ses jobs en colonnes dans l'ordre de leurs `needs`. */
export function PipelineView({ pipeline, tech }: { pipeline: Pipeline; tech: Record<string, TechLabel> }) {
  return (
    <div className={styles.pipeline}>
      <div className={styles.head}>
        <b className={styles.name}>{pipeline.name}</b>
        <span className={styles.path}>{pipeline.path}</span>
      </div>
      {pipeline.parseError ? <p className={styles.error}>Illisible : {pipeline.parseError}</p> : (
        <div className={styles.flow}>
          <div className={styles.trigger}>
            <span className={styles.kind}>quand</span>
            {pipeline.triggers.map((t) => (
              <span key={t.label} className={styles.event}>{t.label}<ProofRef proof={{ path: pipeline.path, line: t.line }} /></span>
            ))}
          </div>
          {jobColumns(pipeline).map((col, i) => (
            <div key={i} className={styles.column}>
              {col.map((j) => <JobCard key={j.id} job={j} path={pipeline.path} tech={tech} />)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
