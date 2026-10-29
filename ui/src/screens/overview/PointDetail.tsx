import { useMemo, useState } from "react";
import type { MapPayload } from "../../api/types";
import { useSource } from "../../api/useSource";
import { Button } from "../../components/Button";
import { CodeExcerpt } from "../../components/CodeExcerpt";
import { ProofRef } from "../../components/ProofRef";
import { whereLabel, type PointRow } from "../../domain/overview/points";
import { sentence } from "../../domain/text/sentence";
import { PointDiagram } from "./PointDiagram";
import styles from "./PointDetail.module.css";
import { TechText } from "../../components/TechText";

const AROUND = 3;

/** Le point ouvert : où il est constaté, ce qu'il touche, ce qu'il dit, et la ligne elle-même sur demande. */
export function PointDetail({ row, map }: { row: PointRow; map: MapPayload }) {
  const nodes = useMemo(() => new Map(map.model.nodes.map((n) => [n.id, n])), [map.model]);
  const [focus, setFocus] = useState(0);
  const [showCode, setShowCode] = useState(false);
  const finding = row.findings[focus] ?? row.findings[0]!;
  const proof = finding.proof[0];
  const span = proof && proof.line > 0 ? { path: proof.path, from: Math.max(1, proof.line - AROUND), to: proof.line + AROUND } : undefined;
  const source = useSource(showCode ? span : undefined, map.builtAt);
  const marks = finding.proof.filter((p) => p.path === proof?.path).map((p) => p.line);

  return (
    <div className={styles.detail}>
      <i className={`${styles.corner} ${styles.a}`} /><i className={`${styles.corner} ${styles.b}`} />
      <i className={`${styles.corner} ${styles.c}`} /><i className={`${styles.corner} ${styles.d}`} />
      {proof && <div className={styles.where}>{whereLabel(proof)}</div>}
      <PointDiagram row={row} nodes={nodes} tech={map.tech} focus={focus} />
      <div className={styles.text}>
        <b className={styles.headline}><TechText text={sentence(row.label)} />.</b>
        <ul className={styles.findings}>
          {row.findings.map((f, i) => (
            <li key={i}>
              <button type="button" className={`${styles.finding} ${i === focus ? styles.on : ""}`} aria-pressed={i === focus}
                onClick={() => setFocus(i)} disabled={row.findings.length === 1}>
                <span><TechText text={sentence(f.message)} />.</span>
                <span className={styles.refs}>{f.proof.map((p, k) => <ProofRef key={k} proof={p} />)}</span>
              </button>
            </li>
          ))}
        </ul>
        {span && (
          <div className={styles.actions}>
            <Button onClick={() => setShowCode((v) => !v)}>{showCode ? "Masquer la ligne" : "Voir la ligne"}</Button>
          </div>
        )}
        {showCode && source?.status === "ready" && <CodeExcerpt excerpt={source.excerpt} marks={marks} marksLabel="constaté ici" />}
        {showCode && source?.status === "error" && <p className={styles.error}>Le passage n'a pas pu être lu : {source.message}</p>}
      </div>
    </div>
  );
}
