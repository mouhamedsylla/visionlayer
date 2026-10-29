import type { ArchModelV2, ArchNode, Entity, TechLabel } from "../../api/types";
import { screenHref } from "../../app/screens";
import { Pill } from "../../components/Pill";
import { ProofRef } from "../../components/ProofRef";
import { PanelAction, PanelBack, PanelItem, PanelSection, SidePanel } from "../../components/SidePanel";
import type { StoreAccess } from "../../domain/data/actors";
import { triggerSentence, writtenByTriggers } from "../../domain/data/controls";
import { entityFindings } from "../../domain/data/findings";
import { stateFields } from "../../domain/data/lifecycle";
import { modifyingEntries } from "../../domain/data/summary";
import { Icon } from "../../shell/icons";
import { AccessRows } from "./AccessRows";
import { TableSource } from "./TableSource";
import { TableVerdict } from "./TableVerdict";
import styles from "./TablePanel.module.css";
import { TechText } from "../../components/TechText";

interface Props {
  entity: Entity;
  entities: Entity[];
  store: ArchNode;
  word: string;
  access: StoreAccess;
  model: ArchModelV2;
  tech: Record<string, TechLabel>;
  version: string;
  onClose: () => void;
}

/** Une table choisie : ce qu'en dit son auteur, sa déclaration, ce que le code montre, qui la lit et l'écrit, d'où elle change. */
export function TablePanel({ entity, entities, store, word, access, model, tech, version, onClose }: Props) {
  const own = access.byEntity.get(entity.name) ?? new Map();
  const byTrigger = writtenByTriggers(entity, entities);
  const entries = modifyingEntries(own, model);
  const states = stateFields(entity);
  const points = entityFindings(entity, store, model);
  return (
    <SidePanel label={entity.name} wide>
      <PanelBack onClick={onClose}>← Tout {store.name}</PanelBack>
      <div className={styles.head}>
        <Pill>{word}{entity.group ? ` · ${entity.group.toLowerCase()}` : ""}</Pill>
        <h2 className={styles.title}>{entity.name}</h2>
      </div>
      <TableSource entity={entity} version={version} />
      <TableVerdict entity={entity} access={access} model={model} />
      <AccessRows actors={access.actors} access={own} model={model} tech={tech} />
      {entries.length > 0 && (
        <section className={styles.block}>
          <Pill>Modifiée depuis · {entries.length}</Pill>
          <div className={styles.chips}>
            {entries.map((e) => <span key={e.id} className={styles.chip} title={e.key}><Icon name="write" size={11} />{e.handler?.name ?? e.key}</span>)}
          </div>
        </section>
      )}
      {states.map((f) => (
        <PanelAction key={f.name} href={screenHref("donnees", store.id, entity.name, "cycle")}>
          Le cycle de vie de {f.name} →
        </PanelAction>
      ))}
      {(entity.triggers?.length || byTrigger.length) ? (
        <PanelSection title="Quand elle change">
          {(entity.triggers ?? []).map((t) => <PanelItem key={t.name} title={t.name}><span>{triggerSentence(t)}</span><ProofRef proof={t.proof} /></PanelItem>)}
          {byTrigger.map(({ trigger, on }) => (
            <PanelItem key={trigger.name} title={`écrite par ${trigger.name}`}><span>déclencheur de {on}, {triggerSentence(trigger)}</span><ProofRef proof={trigger.proof} /></PanelItem>
          ))}
        </PanelSection>
      ) : null}
      <PanelSection title={`À vérifier · ${points.length}`} empty="Rien de relevé sur cette table.">
        {points.map((f, i) => <PanelItem key={`${f.code}-${i}`}><span><TechText text={f.message} /></span>{f.proof[0] && <ProofRef proof={f.proof[0]} />}</PanelItem>)}
      </PanelSection>
    </SidePanel>
  );
}
