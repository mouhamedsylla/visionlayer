import type { MapPayload } from "../../api/types";
import { screenHref } from "../../app/screens";
import { Pill } from "../../components/Pill";
import { ProofRef } from "../../components/ProofRef";
import { contractLife } from "../../domain/contracts/life";
import type { ContractRef } from "../../domain/contracts/list";
import { isBackground } from "../../domain/messages/triggers";
import { count } from "../../domain/text/plural";
import { SequenceView } from "../features/SequenceView";
import { TraceLegend } from "../features/TraceLegend";
import { ShapeFields } from "./ShapeFields";
import styles from "./HowView.module.css";

interface Props {
  subject: ContractRef;
  map: MapPayload;
  names: Map<string, string>;
}

/** Ce que dit le module, ce que promet chaque opération champ par champ, et la vie d'un appel en couloirs. */
export function HowView({ subject, map, names }: Props) {
  const { contract, node } = subject;
  const life = contractLife(subject, map.model, names);
  const sealed = contract.sealed;
  const ops = contract.operations.filter((o) => o.request || o.result);
  return (
    <>
      {contract.summary && (
        <section className={styles.box}>
          <h2 className={styles.heading}><Pill>En une phrase</Pill>ce que dit le code</h2>
          <blockquote className={styles.quote}>« {contract.summary.text} »</blockquote>
          <p className={styles.check}>
            <span className={styles.origin}><i className={styles.comment} aria-hidden="true" />commentaire <ProofRef proof={contract.summary.proof} /></span>
            {sealed && (sealed.leaks.length
              ? <span className={styles.leak}>{sealed.packages.join(", ")} importé hors de {node.name} : {sealed.leaks.map((l) => <ProofRef key={`${l.path}:${l.line}`} proof={l} />)}</span>
              : <span className={styles.ok}>vérifié : aucun fichier hors de {node.name} n'importe {sealed.packages.join(" ni ")}</span>)}
          </p>
        </section>
      )}

      <h2 className={styles.title}>
        1 · Ce que le contrat promet{ops.length === 1 ? ` : une opération, ${ops[0]!.name}` : ops.length ? ` : ${count(ops.length, "opération")}` : ""}
      </h2>
      {ops.map((o) => (
        <div key={o.name} className={styles.op}>
          {o.comment && <p className={styles.opNote}>{o.name} · « {o.comment} »</p>}
          {o.request && <ShapeFields verb="envoie" shape={o.request} />}
          {o.result && <ShapeFields verb="reçoit" shape={o.result} />}
        </div>
      ))}
      {!ops.length && <p className={styles.empty}>Les opérations de {contract.name} ne reçoivent ni ne rendent de type déclaré dans le dépôt : leurs champs ne sont pas lus.</p>}

      <h2 className={styles.title}>
        2 · La vie d'un appel, de la feature au fournisseur et retour
        {life.steps.length > 0 && <span className={styles.count}>{count(life.steps.length, "étape")}</span>}
      </h2>
      {life.item && life.steps.length ? (
        <>
          <SequenceView item={life.item} map={map} names={names} trace={{ lanes: life.lanes, rows: life.steps }} />
          <p className={styles.more}>
            Le déroulé complet de {life.item.entry.handler?.name ?? life.item.entry.key} :{" "}
            <a href={screenHref(isBackground(life.item.entry) ? "messages" : "features", life.item.entry.id)}>voir son trajet</a>
          </p>
          <TraceLegend />
        </>
      ) : <p className={styles.empty}>Aucun point d'entrée lu n'appelle {contract.selector?.symbol.name ?? "la fonction qui choisit"} : la vie d'un appel ne peut pas être suivie depuis une feature.</p>}
    </>
  );
}
