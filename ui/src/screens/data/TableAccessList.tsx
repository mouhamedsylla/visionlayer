import type { ArchModelV2 } from "../../api/types";
import { ProofRef } from "../../components/ProofRef";
import { PanelItem, PanelSection } from "../../components/SidePanel";
import { reachedBy, type Access, type Actor } from "../../domain/data/actors";
import styles from "./TablePanel.module.css";

interface Props {
  actors: Actor[];
  access: Map<string, Access>;
  model: ArchModelV2;
}

/** Qui lit et qui écrit la table : par acteur, chaque ligne de code et le point d'entrée qui l'atteint. */
export function TableAccessList({ actors, access, model }: Props) {
  const rows = (["read", "write"] as const).flatMap((verb) =>
    actors.filter((a) => access.get(a.id)?.[verb].length).map((a) => ({ verb, actor: a, occ: access.get(a.id)![verb] })));
  const readers = rows.filter((r) => r.verb === "read").length;
  const writers = rows.length - readers;
  return (
    <PanelSection title={`Lue par · ${readers} · écrite par · ${writers}`} empty="Aucune lecture ni écriture lue dans le code.">
      {rows.map(({ verb, actor, occ }) => (
        <PanelItem key={`${verb}-${actor.id}`} title={<><span className={verb === "write" ? styles.write : styles.read}>{verb === "write" ? "écrit" : "lit"}</span> {actor.label}</>}>
          {actor.detail && <span>tâche planifiée, {actor.detail}</span>}
          {occ.map((o) => {
            const who = reachedBy(o, model);
            return (
              <span key={`${o.path}:${o.line}`} className={styles.occ} title={who.all.join("\n") || undefined}>
                <ProofRef proof={o} />{who.label && <span>{who.label}</span>}
              </span>
            );
          })}
        </PanelItem>
      ))}
    </PanelSection>
  );
}
