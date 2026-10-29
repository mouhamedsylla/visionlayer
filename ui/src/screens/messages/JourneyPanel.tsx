import type { ArchModelV2 } from "../../api/types";
import { screenHref } from "../../app/screens";
import { PanelCard } from "../../components/panel/PanelCard";
import { PanelReach, reachCount } from "../../components/panel/PanelReach";
import { PanelStats } from "../../components/panel/PanelStats";
import { PanelSwitch } from "../../components/panel/PanelSwitch";
import { PanelVars } from "../../components/panel/PanelVars";
import { PanelNote, PanelSection, SidePanel } from "../../components/SidePanel";
import { TechText } from "../../components/TechText";
import { entryNature } from "../../domain/block/entries";
import { findEntry, type EntryRef } from "../../domain/features/list";
import { branchesOf, envOf, isBackground, producersOf } from "../../domain/messages/triggers";

interface Props {
  item: EntryRef;
  model: ArchModelV2;
  names: Map<string, string>;
}

/** À côté du trajet : ses chiffres, ce qu'il touche, les branches que son code distingue, qui met en file, et les variables qu'il lit. */
export function JourneyPanel({ item, model, names }: Props) {
  const { entry } = item;
  const branches = branchesOf(entry);
  const producers = producersOf(entry, model);
  const env = envOf(item);
  const reach = reachCount(entry, names);
  const stats = [
    { n: entry.flow?.length ?? 0, label: (entry.flow?.length ?? 0) > 1 ? "étapes" : "étape" },
    { n: branches.length, label: branches.length > 1 ? "branches" : "branche" },
    { n: env.length, label: env.length > 1 ? "variables" : "variable" },
  ];
  return (
    <SidePanel label="Autour du trajet">
      <PanelStats items={stats} />
      {reach > 0 && <PanelSection title={`Ce qu'il touche · ${reach}`}><PanelReach entry={entry} names={names} /></PanelSection>}
      {branches.length > 0 && (
        <PanelSection title={`Branches lues · ${branches.length}`}>
          <PanelSwitch head={`${entry.handler?.name ?? entry.key}()`} proof={entry.handler} ways={branches.map((b) => ({ when: b.when, target: `${b.name}()`, proof: b.proof }))} />
        </PanelSection>
      )}
      {entry.kind === "message" && (
        <PanelSection title={`Mis en file par · ${producers.length}`} empty="Aucune ligne du dépôt ne publie sur cette file.">
          {producers.flatMap((p) => (p.entrypoints.length ? p.entrypoints : [undefined]).map((id) => {
            const from = id ? findEntry(model, id) : undefined;
            return (
              <PanelCard key={`${p.proof.path}:${p.proof.line}:${id ?? ""}`} kind={from ? entryNature(from.entry) : "publication"}
                title={from?.entry.handler?.name ?? id ?? "aucun point d'entrée ne l'atteint"} proof={p.proof}
                href={id ? screenHref(from && isBackground(from.entry) ? "messages" : "features", id) : undefined}>
                {from && <span><TechText text={from.entry.key} /></span>}
              </PanelCard>
            );
          }))}
        </PanelSection>
      )}
      <PanelSection title={`Variables lues · ${env.length}`} empty="Aucune variable d'environnement lue par son code.">
        {env.length > 0 ? [<PanelNote key="note">Noms seulement, jamais les valeurs.</PanelNote>, <PanelVars key="vars" vars={env} />] : undefined}
      </PanelSection>
      <PanelSection title="Comment c'est lu" open={false}>
        <PanelNote>
          Chaque étape vient d'une ligne de son code, dans l'ordre, les fonctions du dépôt dépliées. Une branche est une fonction appelée sous une condition,
          reprise telle qu'écrite.{entry.kind !== "schedule" && entry.kind !== "message" && " Ce que fait l'émetteur quand il ne reçoit pas de réponse n'est pas dans ce dépôt : une fiche d'agent peut le dire."}
        </PanelNote>
      </PanelSection>
    </SidePanel>
  );
}
