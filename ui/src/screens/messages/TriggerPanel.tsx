import type { MapPayload } from "../../api/types";
import { useSource } from "../../api/useSource";
import { screenHref } from "../../app/screens";
import { CodeExcerpt } from "../../components/CodeExcerpt";
import { ProofRef } from "../../components/ProofRef";
import { PanelReach, reachCount } from "../../components/panel/PanelReach";
import { PanelStats } from "../../components/panel/PanelStats";
import { PanelAction, PanelItem, PanelNote, PanelSection, PanelTitle, SidePanel } from "../../components/SidePanel";
import { entryNature } from "../../domain/block/entries";
import type { EntryRef } from "../../domain/features/list";
import { traceFailures } from "../../domain/features/trace";
import { launchesOf, whenLabel } from "../../domain/messages/triggers";
import { joinWords } from "../../domain/text/plural";
import { sentence } from "../../domain/text/sentence";
import { TechText } from "../../components/TechText";

const AROUND = 2;

interface Props {
  item: EntryRef;
  entries: EntryRef[];
  map: MapPayload;
  names: Map<string, string>;
}

/** Le déclencheur choisi : la ligne qui le déclare, ce qui part plusieurs fois, ce qui est constaté sur son code, et comment c'est trouvé. */
export function TriggerPanel({ item, entries, map, names }: Props) {
  const { entry } = item;
  const { model } = map;
  const p = entry.proof;
  const source = useSource({ path: p.path, from: Math.max(1, p.line - AROUND), to: p.line + AROUND }, map.builtAt);
  const launches = launchesOf(item, model);
  const failures = traceFailures(item, model).filter((f) => f.type !== "planifié");
  const reach = reachCount(entry, names);
  const steps = entry.flow?.length ?? 0;
  const stats = [
    ...(item.node.instances ? [{ n: item.node.instances.min, label: `${item.node.instances.min > 1 ? "exemplaires" : "exemplaire"} de ${item.node.name}` }] : []),
    { n: steps, label: steps > 1 ? "étapes" : "étape" },
    { n: failures.length, label: failures.length > 1 ? "constats" : "constat" },
  ];
  const packs = [...new Set(entries.map((x) => x.entry.proof.pack).filter(Boolean))] as string[];
  return (
    <SidePanel label={entry.handler?.name ?? entry.key}>
      <PanelTitle kind={entryNature(entry)} title={entry.handler?.name ?? entry.key} origin={<TechText text={sentence(whenLabel(entry, model, names))} />} />
      <PanelStats items={stats} />
      {source?.status === "ready" && <CodeExcerpt excerpt={source.excerpt} marks={[p.line]} marksLabel="déclaré ici" />}
      {source?.status === "error" && <PanelNote>La ligne n'a pas pu être lue : {source.message}</PanelNote>}
      {reach > 0 && <PanelSection title={`Ce qu'il touche · ${reach}`}><PanelReach entry={entry} names={names} /></PanelSection>}
      {launches && (
        <PanelItem title={`Lancé par chaque exemplaire · ×${launches.times}`}>
          <span><TechText text={sentence(launches.finding.message)} />.</span>
          <ProofRef proof={launches.finding.proof.at(-1)!} />
        </PanelItem>
      )}
      {failures.length > 0 && (
        <PanelSection title={`Constaté sur son code · ${failures.length}`}>
          {failures.map((f, i) => <PanelItem key={i} title={f.type}><span><TechText text={f.text} /></span>{f.proof && <ProofRef proof={f.proof} />}</PanelItem>)}
        </PanelSection>
      )}
      {(entry.flow?.length ?? 0) > 0 && <PanelAction href={screenHref("messages", entry.id)}>Voir son trajet, étape par étape</PanelAction>}
      <PanelSection title="Comment c'est trouvé" open={false}>
        <PanelNote>
          Les tâches déclarées auprès d'une horloge, les fonctions qui écoutent une file, les routes qu'un service externe appelle en signant,
          et le nombre d'exemplaires déclaré au déploiement. Ici par {joinWords(packs)} ; la même lecture vaut pour d'autres bibliothèques dès qu'un pack les décrit.
        </PanelNote>
      </PanelSection>
    </SidePanel>
  );
}
