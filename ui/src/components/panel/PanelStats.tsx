import styles from "./PanelStats.module.css";

/** Quelques chiffres lus dans le modèle, en tuiles côte à côte : le nombre en grand, ce qu'il compte dessous. */
export function PanelStats({ items }: { items: { n: number | string; label: string }[] }) {
  return (
    <dl className={styles.stats}>
      {items.map((s) => <div key={s.label}><dt>{s.label}</dt><dd>{s.n}</dd></div>)}
    </dl>
  );
}
