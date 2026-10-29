import type { ArchModelV2, ArchNode } from "../../api/types";
import { Pill } from "../../components/Pill";
import { blockEntries } from "../../domain/block/entries";
import { apiResources } from "../../domain/block/resources";
import { count } from "../../domain/text/plural";
import { BackgroundEntries } from "./BackgroundEntries";
import { ResourceCard } from "./ResourceCard";
import styles from "./ApiView.module.css";

interface Props {
  node: ArchNode;
  model: ArchModelV2;
  names: Map<string, string>;
  selected?: string;
  onSelect: (id: string) => void;
}

/** L'intérieur d'un bloc : son API rangée par ressource, puis ce qui tourne sans qu'on l'appelle. */
export function ApiView({ node, model, names, selected, onSelect }: Props) {
  const entries = blockEntries(node);
  const resources = apiResources(entries, model, names);
  const routes = resources.reduce((n, r) => n + r.entries.length, 0);
  const guarded = entries.filter((e) => e.kind === "http" && e.access).length;
  return (
    <div className={styles.wrap}>
      {resources.length > 0 && (
        <>
          <div className={styles.caption}>
            <Pill>API · {count(routes, "route", "routes")} en {count(resources.length, "ressource", "ressources")}</Pill>
            <span className={styles.hint}>
              <span className={styles.param}>:id</span> paramètre · garde d'accès lue sur {guarded} {routes > 1 ? `des ${routes} routes` : "route"}
            </span>
          </div>
          <div className={styles.cards}>
            {resources.map((r) => <ResourceCard key={r.path} resource={r} model={model} names={names} selected={selected} onSelect={onSelect} />)}
          </div>
        </>
      )}
      <BackgroundEntries entries={entries.filter((e) => e.kind !== "http")} model={model} names={names} selected={selected} onSelect={onSelect} />
      {entries.length === 0 && <p className={styles.hint}>Aucun point d'entrée lu dans ce bloc.</p>}
    </div>
  );
}
