import { useEffect, useRef, useState } from "react";
import styles from "./Glance.module.css";

/** Une phrase courte comptée sur la carte : `7 constats à vérifier` ; `attention` quand elle demande qu'on aille voir. */
export interface GlanceNote {
  text: string;
  tone: "attention" | "plain";
}

const split = (text: string) => {
  const m = text.match(/^(\d+)\s+(.*)$/);
  return m ? { value: m[1]!, label: m[2]! } : { value: "", label: text };
};

/**
 * `À savoir` : un bouton qui dit combien de points et combien demandent qu'on
 * aille voir, puis la liste rangée au clic. Elle tient pour trois phrases
 * comme pour trente : les plus urgentes d'abord, la liste défile.
 */
export function Glance({ title = "À savoir", notes }: { title?: string; notes: GlanceNote[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  if (!notes.length) return null;
  const urgent = notes.filter((n) => n.tone === "attention");
  const plain = notes.filter((n) => n.tone === "plain");
  const group = (heading: string, list: GlanceNote[], hot: boolean) => list.length > 0 && (
    <div className={styles.group}>
      <span className={styles.heading}>{heading} · {list.length}</span>
      <ul className={styles.list}>
        {list.map((n) => {
          const { value, label } = split(n.text);
          return <li key={n.text} className={`${styles.row} ${hot ? styles.hot : ""}`}><span className={styles.value}>{value}</span><span>{label}</span></li>;
        })}
      </ul>
    </div>
  );
  return (
    <div ref={ref} className={styles.wrap}>
      <button type="button" className={`${styles.button} ${open ? styles.on : ""}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <span className={styles.total}>{notes.length}</span>
        {urgent.length > 0 && <span className={styles.urgent}><i className={styles.dot} />{urgent.length} à aller voir</span>}
        <i className={styles.chevron} aria-hidden="true" />
      </button>
      {open && (
        <div className={styles.pop} role="dialog" aria-label={title}>
          {group("À aller voir", urgent, true)}
          {group("Pour information", plain, false)}
        </div>
      )}
    </div>
  );
}
