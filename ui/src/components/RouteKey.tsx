import { splitRoute } from "../domain/block/resources";
import styles from "./RouteKey.module.css";

/** La méthode d'une route dans sa pastille, puis son chemin, chaque paramètre surligné : le même rendu sur chaque écran. */
export function RouteMethod({ routeKey }: { routeKey: string }) {
  const { method } = splitRoute(routeKey);
  return <span className={`${styles.method} ${styles[method.toLowerCase()] ?? ""}`}>{method || "ANY"}</span>;
}

export function RoutePath({ routeKey, inline }: { routeKey: string; inline?: boolean }) {
  const { segments } = splitRoute(routeKey);
  return (
    <span className={`${styles.path} ${inline ? styles.inline : ""}`}>
      {segments.length === 0 ? "/" : segments.map((s, i) => <span key={i}><wbr />/<span className={s.param ? styles.param : undefined}>{s.text}</span></span>)}
    </span>
  );
}
