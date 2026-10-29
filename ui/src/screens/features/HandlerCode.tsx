import type { Entrypoint } from "../../api/types";
import { useSource } from "../../api/useSource";
import { CodeExcerpt } from "../../components/CodeExcerpt";
import styles from "./HandlerCode.module.css";

/** La fonction du point d'entrée en entier, chaque ligne du déroulé mise en avant. */
export function HandlerCode({ entry, version }: { entry: Entrypoint; version: string }) {
  const h = entry.handler;
  const own = (entry.flow ?? []).filter((s) => s.depth === 0 && s.proof.path === h?.path).map((s) => s.proof.line);
  const range = entry.ranges?.find(([a, b]) => h && a <= h.line && b >= h.line);
  const to = range?.[1] ?? Math.max(h?.line ?? 1, ...own) + 1;
  const source = useSource(h ? { path: h.path, from: h.line, to } : undefined, version);
  if (!h) return <p className={styles.note}>Le moteur n'a pas relié ce point d'entrée à sa fonction.</p>;
  return (
    <div className={styles.wrap}>
      {source?.status === "ready" && <CodeExcerpt excerpt={source.excerpt} marks={own} marksLabel="étapes du déroulé" />}
      {source?.status === "loading" && <p className={styles.note}>Lecture de {h.path}</p>}
      {source?.status === "error" && <p className={styles.note}>Le fichier n'a pas pu être lu : {source.message}</p>}
    </div>
  );
}
