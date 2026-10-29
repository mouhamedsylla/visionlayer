import type { ArchModelV2, TechLabel } from "../../api/types";
import { Pill } from "../../components/Pill";
import { ProofRef } from "../../components/ProofRef";
import type { Access, Actor } from "../../domain/data/actors";
import { accessRows } from "../../domain/data/summary";
import { Icon } from "../../shell/icons";
import { ActorHead } from "./ActorHead";
import styles from "./TablePanel.module.css";

interface Props {
  actors: Actor[];
  access: Map<string, Access>;
  model: ArchModelV2;
  tech: Record<string, TechLabel>;
}

/** `Lue par · 2 · écrite par · 1` : une ligne par verbe et par acteur, avec les fichiers où le code le fait. */
export function AccessRows({ actors, access, model, tech }: Props) {
  const nodes = new Map(model.nodes.map((n) => [n.id, n]));
  const rows = accessRows(actors, access);
  const readers = rows.filter((r) => r.verb === "read").length;
  return (
    <section className={styles.block}>
      <Pill>Lue par · {readers} · écrite par · {rows.length - readers}</Pill>
      {!rows.length && <p className={styles.muted}>Aucune lecture ni écriture lue dans le code.</p>}
      <div className={styles.rows}>
        {rows.map(({ verb, actor, files }) => (
          <div key={`${verb}-${actor.id}`} className={styles.kv}>
            <span className={verb === "write" ? styles.write : styles.read}><Icon name={verb} size={11} />{verb === "write" ? "écrit" : "lit"}</span>
            <span><ActorHead actor={actor} node={nodes.get(actor.nodeId)} tech={tech} />{actor.detail && <span className={styles.muted}> · planifié</span>}</span>
            <span className={styles.files}>{files.map((o) => <ProofRef key={o.path} proof={o} />)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
