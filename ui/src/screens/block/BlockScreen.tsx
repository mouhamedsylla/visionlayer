import { useMemo, useState } from "react";
import type { MapPayload, ProjectInfo } from "../../api/types";
import { screenHref } from "../../app/screens";
import { ProofRef } from "../../components/ProofRef";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StatusMessage } from "../../components/StatusMessage";
import { kindLabel, primaryTech, primaryTechId } from "../../domain/architecture/describe";
import { TechLogo } from "../../components/TechLogo";
import { blockEntries, entryCounters } from "../../domain/block/entries";
import { count } from "../../domain/text/plural";
import { BlockCounters } from "./BlockCounters";
import { BlockPanel } from "./BlockPanel";
import { EntryPanel } from "./EntryPanel";
import { ApiView } from "./ApiView";
import styles from "./BlockScreen.module.css";

interface Props {
  project: ProjectInfo;
  map: MapPayload;
  nodeId: string;
}

/** L'intérieur d'un bloc : ses points d'entrée, ce que chacun fait, et ce qui l'entoure. */
export function BlockScreen({ project, map, nodeId }: Props) {
  const { model, tech } = map;
  const node = model.nodes.find((n) => n.id === nodeId);
  const names = useMemo(() => new Map(model.nodes.map((n) => [n.id, n.name])), [model]);
  const [selected, setSelected] = useState<string>();
  if (!node) return <StatusMessage title="Ce bloc n'est pas sur la carte" detail={nodeId} />;

  const entry = blockEntries(node).find((e) => e.id === selected);
  const main = primaryTech(node, tech);
  const logoId = primaryTechId(node, tech) ?? node.tech?.[0];
  const techNames = (node.tech ?? []).map((t) => tech[t]?.name ?? t).filter((t) => t !== main);
  const origin = node.proof.find((p) => p.source === "manifest") ?? node.proof[0];
  const summary = [kindLabel(node, tech), techNames.join(", "), count(blockEntries(node).length, "point d'entrée", "points d'entrée"),
    node.files && count(node.files.length, "fichier", "fichiers")].filter(Boolean).join(" · ");

  return (
    <div className={styles.screen}>
      <ScreenHeader
        crumbs={[{ label: project.name }, { label: "Architecture", href: screenHref("architecture") }, { label: node.name }]}
        title={node.name}
        lead={<span className={styles.lead}>{logoId && <TechLogo id={logoId} label={tech[logoId]} size={26} />}<span>{summary}{origin && <> · {origin.source === "manifest" ? "déclaré à" : "vu à"} <ProofRef proof={origin} /></>}</span></span>}
      >
        <BlockCounters counters={entryCounters(node, model)} />
      </ScreenHeader>
      <div className={styles.body}>
        <div className={styles.main}>
          <ApiView node={node} model={model} names={names} selected={selected} onSelect={(id) => setSelected((c) => (c === id ? undefined : id))} />
        </div>
        {entry ? <EntryPanel entry={entry} model={model} names={names} onClose={() => setSelected(undefined)} />
          : <BlockPanel node={node} model={model} tech={tech} />}
      </div>
    </div>
  );
}
