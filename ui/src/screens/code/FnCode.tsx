import { useEffect, useRef, useState } from "react";
import type { CodeFunction, FlowStep } from "../../api/types";
import { useSource } from "../../api/useSource";
import { Button } from "../../components/Button";
import { CodeExcerpt } from "../../components/CodeExcerpt";
import styles from "./FnCode.module.css";

const PAGE = 80;

interface Props {
  fn: CodeFunction;
  steps: FlowStep[];
  selected: number;
  version: string;
}

/**
 * La fonction en entier, en lecture seule, telle qu'écrite : le numéro de
 * chaque étape dans la marge, la ligne de l'étape choisie surlignée et mise en
 * vue. Une longue fonction se lit par pages de quatre-vingts lignes, sur place.
 */
export function FnCode({ fn, steps, selected, version }: Props) {
  const path = fn.proof.path;
  const lineOf = (s?: FlowStep) => (s && s.proof.path === path ? s.proof.line : undefined);
  const focus = lineOf(steps[selected]);
  const pageOf = (line?: number) => (line ? Math.floor((line - fn.proof.line) / PAGE) : 0);
  const [page, setPage] = useState(pageOf(focus));
  // la fiche remonte ce composant à chaque fonction (key) : seule l'étape choisie change la page
  useEffect(() => setPage(pageOf(focus)), [focus]);
  const from = fn.proof.line + page * PAGE;
  const to = Math.min(fn.end, from + PAGE - 1);
  const source = useSource({ path, from, to }, version);
  const box = useRef<HTMLDivElement>(null);
  // seul le code défile jusqu'à l'étape choisie, jamais la page autour
  useEffect(() => {
    const el = box.current?.querySelector("[data-focus]");
    if (!box.current || !el) return;
    const [r, b] = [el.getBoundingClientRect(), box.current.getBoundingClientRect()];
    if (r.top < b.top || r.bottom > b.bottom) box.current.scrollTo({ top: box.current.scrollTop + r.top - b.top - b.height / 3, behavior: "smooth" });
  }, [focus, source]);

  const badges = new Map<number, number>();
  steps.forEach((s, i) => { const n = lineOf(s); if (n && !badges.has(n)) badges.set(n, i + 1); });
  const pages = Math.ceil((fn.end - fn.proof.line + 1) / PAGE);
  return (
    <div ref={box} className={styles.wrap}>
      {source?.status === "ready" && <CodeExcerpt excerpt={source.excerpt} badges={badges} focus={focus} marks={focus ? [focus] : []} marksLabel="l'étape choisie" />}
      {source?.status === "loading" && <p className={styles.note}>Lecture de {path}, lignes {from} à {to}</p>}
      {source?.status === "error" && <p className={styles.note}>Le fichier n'a pas pu être lu : {source.message}</p>}
      {pages > 1 && (
        <div className={styles.pages}>
          <Button onClick={() => setPage((p) => p - 1)} disabled={page === 0}>Lignes précédentes</Button>
          <span>lignes {from} à {to} sur {fn.proof.line} à {fn.end}</span>
          <Button onClick={() => setPage((p) => p + 1)} disabled={page >= pages - 1}>Lignes suivantes</Button>
        </div>
      )}
      <p className={styles.note}>Le numéro à gauche du code est celui de l'étape ; la ligne surlignée est l'étape choisie.</p>
    </div>
  );
}
