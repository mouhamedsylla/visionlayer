import type { Entity } from "../../api/types";
import { screenHref } from "../../app/screens";
import { Pill } from "../../components/Pill";
import { PanelBack, PanelNote, SidePanel } from "../../components/SidePanel";
import { columnGroups, writtenBy } from "../../domain/data/shape";
import { count } from "../../domain/text/plural";
import styles from "./ShapePanel.module.css";

/** La forme de l'entité, à côté de son cycle : ses colonnes, regroupées par qui les écrit. */
export function ShapePanel({ entity, storeId }: { entity: Entity; storeId: string }) {
  const groups = columnGroups(entity);
  return (
    <SidePanel label={`Forme de ${entity.name}`} wide>
      <PanelBack href={screenHref("donnees", storeId, entity.name)}>← Toutes les tables</PanelBack>
      <Pill>Forme · colonnes · {entity.fields?.length ?? 0}</Pill>
      <table className={styles.table}>
        <thead><tr><th>colonne · écrite par</th><th>preuve</th></tr></thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.names.join()}>
              <td><span className={styles.name}>{g.names.join(" · ")}</span><span className={styles.muted}>{writtenBy(g)}</span></td>
              <td className={styles.ev}>{g.files.length === 1 ? g.files[0]!.split("/").pop() : g.files.length ? count(g.files.length, "fichier") : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <PanelNote>
        Une colonne est dite écrite quand le code lui donne une valeur par son nom (<code>.set({"{ status }"})</code>, <code>.values(…)</code>).
        Une écriture de la ligne entière (<code>.values(input)</code>) ne dit pas ses colonnes : elle n'est pas comptée ici.
      </PanelNote>
    </SidePanel>
  );
}
