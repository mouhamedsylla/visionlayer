import type { ArchModelV2, Entrypoint } from "../../api/types";
import { ProofRef } from "../../components/ProofRef";
import { PanelBack, PanelItem, PanelNote, PanelSection, PanelTitle, SidePanel } from "../../components/SidePanel";
import { effectsOf, effectVerb } from "../../domain/block/effects";
import { entryNature, triggeredBy } from "../../domain/block/entries";
import { count } from "../../domain/text/plural";

interface Props {
  entry: Entrypoint;
  model: ArchModelV2;
  names: Map<string, string>;
  onClose: () => void;
}

const GUARD: Record<string, string> = {
  public: "aucune garde trouvée", authenticated: "connexion demandée", role: "rôle demandé",
  signature: "signature vérifiée", internal: "appel interne seulement", unknown: "garde non reconnue",
};

/** Un point d'entrée choisi : sa fonction, sa garde, et chaque effet avec les lignes qui le prouvent. */
export function EntryPanel({ entry, model, names, onClose }: Props) {
  const effects = effectsOf(entry.id, model);
  const by = triggeredBy(entry, names, model);
  return (
    <SidePanel label={entry.key}>
      <PanelBack onClick={onClose}>← Tout le bloc</PanelBack>
      <PanelTitle kind={entryNature(entry)} title={entry.key} origin={by.length ? `déclenché par ${by.join(", ")}` : undefined} />
      {entry.handler && (
        <PanelItem title={entry.handler.name}>
          <ProofRef proof={{ path: entry.handler.path, line: entry.handler.line, source: "syntax" }} />
        </PanelItem>
      )}
      {entry.access && (
        <PanelItem title={GUARD[entry.access.level]}>{entry.access.proof && <ProofRef proof={entry.access.proof} />}</PanelItem>
      )}
      <PanelSection title={`Effets · ${effects.length}`} empty="Aucune lecture, écriture ni appel atteint par ce code.">
        {effects.map((e) => (
          <PanelItem key={`${e.kind}-${e.to}-${e.target}`} title={`${effectVerb(e.kind)} ${e.target ?? names.get(e.to) ?? e.to}`}>
            {e.target && <span>{names.get(e.to) ?? e.to}</span>}
            {e.occurrences.map((o) => <ProofRef key={`${o.path}:${o.line}`} proof={o} />)}
          </PanelItem>
        ))}
      </PanelSection>
      {entry.files && <PanelNote>{count(entry.files.length, "fichier exécuté", "fichiers exécutés")} : suivis depuis sa fonction, d'appel en appel.</PanelNote>}
    </SidePanel>
  );
}
