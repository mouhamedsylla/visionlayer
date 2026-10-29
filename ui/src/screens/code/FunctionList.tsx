import { useMemo, useState } from "react";
import type { ArchModelV2, TechLabel } from "../../api/types";
import { Pill } from "../../components/Pill";
import { filterTree, functionTree } from "../../domain/code/functions";
import { FunctionBlock } from "./FunctionBlock";
import styles from "./FunctionList.module.css";

/** Au-delà, les blocs s'ouvrent un à un : la liste reste lisible sur un gros dépôt. */
const OPEN_UP_TO = 120;

/** Les fonctions du dépôt, par bloc puis par fichier, avec un filtre par nom de fonction ou de fichier ; chaque ligne ouvre sa fiche. */
export function FunctionList({ model, tech }: { model: ArchModelV2; tech: Record<string, TechLabel> }) {
  const tree = useMemo(() => functionTree(model), [model]);
  const names = useMemo(() => new Map(model.nodes.map((n) => [n.id, n.name])), [model]);
  const total = tree.reduce((n, b) => n + b.files.reduce((m, f) => m + f.fns.length, 0), 0);
  const [query, setQuery] = useState("");
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const shown = filterTree(tree, query);
  const openByDefault = total <= OPEN_UP_TO || query.trim() !== "";
  const flip = (id: string) => setToggled((t) => { const n = new Set(t); if (!n.delete(id)) n.add(id); return n; });
  return (
    <div className={styles.wrap}>
      <div className={styles.caption}>
        <Pill>Fonctions · {total}</Pill>
        <span className={styles.hint}>rangées par bloc et par fichier · étapes, refus et appelants lus dans leur code</span>
        <input className={styles.filter} type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer : fonction ou fichier" aria-label="Filtrer par nom de fonction ou de fichier" />
      </div>
      {shown.map((b) => (
        <FunctionBlock key={b.node.id} block={b} tech={tech} names={names}
          open={openByDefault !== toggled.has(b.node.id)} onToggle={() => flip(b.node.id)} />
      ))}
      {shown.length === 0 && <p className={styles.hint}>Aucune fonction ni aucun fichier ne contient « {query.trim()} ».</p>}
    </div>
  );
}
