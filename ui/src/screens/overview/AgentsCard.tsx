import { Pill } from "../../components/Pill";
import styles from "./AgentsCard.module.css";

/**
 * Les agents au travail sur le dépôt. VisionLayer lit leur activité (PR,
 * appels au serveur MCP) sans jamais en lancer ; rien n'est relié pour
 * l'instant, et la carte le dit.
 */
export function AgentsCard() {
  return (
    <div className={styles.card}>
      <Pill>Agents</Pill>
      <p className={styles.state}>Aucune activité lue</p>
      <p className={styles.note}>
        Quand un agent travaille sur ce dépôt, sa PR et ses demandes de contexte apparaîtront ici. VisionLayer les lit, il n'en lance aucun.
      </p>
    </div>
  );
}
