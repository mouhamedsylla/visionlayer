import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { Proof } from "../api/types";
import { useSource } from "../api/useSource";
import { useSourceVersion } from "../api/SourceVersion";
import { Breakable } from "./Breakable";
import { CodeExcerpt } from "./CodeExcerpt";
import styles from "./CodePeek.module.css";

const BEFORE = 4;
const AFTER = 10;
const WIDTH = 560;
const GAP = 8;

interface Props {
  proof: Pick<Proof, "path" | "line">;
  anchor: RefObject<HTMLElement | null>;
  onClose: () => void;
}

/** Le passage de code autour d'une ligne, ouvert au-dessus de la page à côté de son repère ; Échap ou un clic ailleurs le ferme. */
export function CodePeek({ proof, anchor, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ left: number; top: number; width: number; up: boolean }>();
  const line = Math.max(1, proof.line);
  const source = useSource({ path: proof.path, from: Math.max(1, line - BEFORE), to: line + AFTER }, useSourceVersion());

  // sous le repère s'il y a la place, sinon au-dessus ; jamais hors de la fenêtre
  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(WIDTH, window.innerWidth - 32);
      const left = Math.min(Math.max(16, r.right - width), window.innerWidth - width - 16);
      const up = window.innerHeight - r.bottom < 320 && r.top > window.innerHeight - r.bottom;
      setAt({ left, width, up, top: up ? window.innerHeight - r.top + GAP : r.bottom + GAP });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [anchor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { onClose(); anchor.current?.focus(); } };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !anchor.current?.contains(t)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [anchor, onClose]);

  if (!at) return null;
  const style = { left: at.left, width: at.width, ...(at.up ? { bottom: at.top } : { top: at.top }) };
  return createPortal(
    <div ref={box} className={`${styles.peek} ${at.up ? styles.up : ""}`} style={style} role="dialog" aria-label={`Code de ${proof.path}, ligne ${proof.line}`}>
      <div className={styles.bar}>
        <span className={styles.path} title={proof.path}><Breakable text={proof.path} /></span>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Fermer le code">×</button>
      </div>
      {source?.status === "ready" && <CodeExcerpt excerpt={source.excerpt} marks={proof.line > 0 ? [proof.line] : []} marksLabel="la ligne citée" />}
      {source?.status === "loading" && <p className={styles.note}>Lecture du passage</p>}
      {source?.status === "error" && <p className={styles.note}>Le passage n'a pas pu être lu : {source.message}</p>}
    </div>,
    document.body,
  );
}
