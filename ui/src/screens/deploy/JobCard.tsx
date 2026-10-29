import type { PipelineJob, TechLabel } from "../../api/types";
import { Breakable } from "../../components/Breakable";
import { ProofRef } from "../../components/ProofRef";
import { TechLogo } from "../../components/TechLogo";
import { STEP_WORD } from "../../domain/deploy/chain";
import styles from "./JobCard.module.css";

/** Un job : ce qu'il attend, son environnement, sa condition, puis ses étapes dans l'ordre, chacune avec sa ligne. */
export function JobCard({ job, path, tech }: { job: PipelineJob; path: string; tech: Record<string, TechLabel> }) {
  const at = (line: number) => ({ path, line });
  return (
    <article className={`${styles.job} ${job.steps.some((s) => s.kind === "deploy") ? styles.ships : ""}`} aria-label={`job ${job.id}`}>
      <header className={styles.head}>
        <b className={styles.id}>{job.id}</b>
        <ProofRef proof={at(job.line)} />
      </header>
      {(job.needs.length > 0 || job.environment || job.when) && (
        <div className={styles.meta}>
          {job.needs.length > 0 && <span>après {job.needs.join(", ")}</span>}
          {job.environment && <span className={styles.env}>environnement {job.environment.name}</span>}
          {job.when && <code className={styles.when}>si {job.when}</code>}
        </div>
      )}
      <ol className={styles.steps}>
        {job.steps.map((s) => (
          <li key={s.line} className={`${styles.step} ${styles[s.kind] ?? ""}`}>
            <span className={styles.word}>{s.target && <TechLogo id={s.target} label={tech[s.target]} size={14} bare />}{STEP_WORD[s.kind]}</span>
            <span className={styles.label}><Breakable text={s.label} /></span>
            <ProofRef proof={at(s.line)} />
            {s.secrets && <span className={styles.secrets}>{s.secrets.map((n) => <span key={n} className={styles.secret}>secret {n}</span>)}</span>}
          </li>
        ))}
      </ol>
    </article>
  );
}
