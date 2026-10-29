import { Pill } from "../../components/Pill";
import styles from "./WorkflowSection.module.css";

/** Les étapes du workflow RYPHA Fabric, et l'outil où VisionLayer lira chacune. */
const STAGES: [string, string][] = [
  ["Planifier", "Linear ou Jira"],
  ["Contexte", "vision_context"],
  ["Plan approuvé", "par toi"],
  ["Construire", "l'agent installé"],
  ["Vérifier", "tests · diff"],
  ["Revue et merge", "GitHub"],
  ["Livrer", "CI · déploiement"],
  ["Observer", "production"],
];

/**
 * La tâche en cours dans le workflow. VisionLayer ne lit encore ni le
 * gestionnaire de tickets ni GitHub : l'écran le dit, et montre les étapes
 * qu'il suivra, toutes en attente.
 */
export function WorkflowSection() {
  return (
    <section className={styles.section}>
      <Pill>En cours dans le workflow</Pill>
      <div className={styles.head}>
        <h2 className={styles.title}>Aucun outil relié</h2>
        <span className={styles.detail}>
          Ni ticket, ni PR, ni agent ne sont lus pour l'instant. Une fois Linear ou Jira et GitHub reliés, la tâche en cours avance ici d'étape en étape.
        </span>
      </div>
      <ol className={styles.track}>
        {STAGES.map(([title, where]) => (
          <li key={title} className={styles.stage}>
            <i className={styles.bar} aria-hidden="true" />
            <i className={styles.dot} aria-hidden="true" />
            <span className={styles.name}>{title}</span>
            <span className={styles.where}>{where}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
