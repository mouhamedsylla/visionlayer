import { useLexicon } from "../api/Lexicon";
import { techPieces, type TechPiece } from "../domain/text/techMarks";
import { Icon, type IconName } from "../shell/icons";
import { Breakable } from "./Breakable";
import { RouteMethod, RoutePath } from "./RouteKey";
import styles from "./TechText.module.css";

const ICON: Partial<Record<NonNullable<TechPiece["kind"]>, IconName>> = { table: "data", queue: "messages", file: "file" };

/** Un seul terme marqué, hors d'une phrase : une table, une file, une variable dans une rangée de pastilles. */
export function TechMark({ piece }: { piece: TechPiece }) {
  const { text, kind } = piece;
  if (!kind) return <>{text}</>;
  if (kind === "route") {
    return <span className={styles.route}><RouteMethod routeKey={text} /><RoutePath routeKey={text} inline /></span>;
  }
  const icon = ICON[kind];
  return (
    <span className={`${styles.mark} ${styles[kind]}`} data-mark={kind}>
      {icon && <Icon name={icon} size={11} />}
      {kind === "block" && <i className={styles.dot} />}
      <span><Breakable text={text} /></span>
    </span>
  );
}

/**
 * Une phrase du moteur où chaque terme technique est marqué selon ce qu'il est :
 * une route avec sa méthode, un nom de code, une table, une file, une variable,
 * une valeur citée. Reconnu par la forme du mot ou par les noms du modèle, jamais par le projet.
 */
export function TechText({ text }: { text: string }) {
  const lex = useLexicon();
  return <>{techPieces(text, lex).map((p, i) => <TechMark key={i} piece={p} />)}</>;
}
