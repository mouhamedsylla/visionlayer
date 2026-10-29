import { useMemo, useState } from "react";
import type { ScreenProps } from "../../app/ScreenProps";
import { ScreenHeader } from "../../components/ScreenHeader";
import { architectureFacts } from "../../domain/architecture/facts";
import { mapLinks, mapNodes } from "../../domain/architecture/links";
import { ArchitectureMap } from "./ArchitectureMap";
import { FactsRow } from "./FactsRow";
import { NodePanel } from "./NodePanel";
import { OverviewPanel } from "./OverviewPanel";
import styles from "./MapScreen.module.css";

/** La carte du système : ce qui tourne, qui parle à qui, et ce qu'il faut vérifier. */
export function MapScreen({ project, map }: Omit<ScreenProps, "params">) {
  const { model, tech } = map;
  const view = useMemo(() => {
    const nodes = mapNodes(model);
    const links = mapLinks(model);
    return { nodes, links, facts: architectureFacts(model, links, tech), names: new Map(nodes.map((n) => [n.id, n.name])) };
  }, [model, tech]);
  const [selected, setSelected] = useState<string>();
  const node = view.nodes.find((n) => n.id === selected);
  const toggle = (id: string) => setSelected((cur) => (cur === id ? undefined : id));

  return (
    <div className={styles.screen}>
      <ScreenHeader crumbs={[{ label: project.name }, { label: "Architecture" }]} title="Architecture"
        lead="Chaque bloc et chaque lien viennent d'une ligne de code ou d'un fichier de déploiement. Ce qui n'est pas lu est dit dans la dernière case.">
        <FactsRow facts={view.facts} tech={tech} />
      </ScreenHeader>
      <div className={styles.body}>
        <div className={styles.map}>
          <ArchitectureMap nodes={view.nodes} links={view.links} findings={model.findings} tech={tech}
            selected={selected} onSelect={toggle} />
        </div>
        {node ? (
          <NodePanel node={node} nodes={view.nodes} links={view.links} findings={model.findings} tech={tech} onClose={() => setSelected(undefined)} />
        ) : (
          <OverviewPanel model={model} links={view.links} tech={tech} />
        )}
      </div>
    </div>
  );
}
