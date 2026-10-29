import type { ArchModelV2, FlowStep } from "../../api/types";
import { screenHref } from "../../app/screens";
import { Breakable } from "../../components/Breakable";
import { Pill } from "../../components/Pill";
import { TechMark } from "../../components/TechText";
import { findFunction, type FnRef } from "../../domain/code/functions";
import { stepView } from "../../domain/features/trace";
import { count } from "../../domain/text/plural";
import { Icon } from "../../shell/icons";
import styles from "./FnSteps.module.css";

interface Props {
  item: FnRef;
  steps: FlowStep[];
  model: ArchModelV2;
  names: Map<string, string>;
  selected: number;
  onSelect: (i: number) => void;
}

/** Ce que touche une étape, en pastille : la table lue ou écrite, la file, le service, le refus, la fonction exécutée qu'on peut ouvrir. */
function StepChip({ step, item, model, names }: { step: FlowStep; item: FnRef; model: ArchModelV2; names: Map<string, string> }) {
  const t = step.target;
  if ((step.kind === "read" || step.kind === "write") && t) return <span className={styles.chip}><Icon name={step.kind} size={11} />{t.entity ?? names.get(t.node) ?? t.node}</span>;
  if (step.kind === "message" && t) return <TechMark piece={{ text: t.topic ?? names.get(t.node) ?? t.node, kind: "queue" }} />;
  if ((step.kind === "request" || step.kind === "call") && t) return <TechMark piece={{ text: names.get(t.node) ?? t.node, kind: "block" }} />;
  if (step.kind === "refuse") return <span className={`${styles.chip} ${styles.refuse}`}>{[step.status, step.code].filter(Boolean).join(" · ") || step.name || "erreur"}</span>;
  const to = step.kind === "invoke" ? item.fn.calls?.find((c) => c.name === step.name)?.to : undefined;
  if (to && findFunction(model, to)) return <a className={`${styles.chip} ${styles.fn}`} href={screenHref("code", to)}>ouvrir {step.name}() →</a>;
  return null;
}

/** Le déroulé de la fonction, numéroté comme dans la marge du code. Un clic met l'étape en vue dans le code. */
export function FnSteps({ item, steps, model, names, selected, onSelect }: Props) {
  const refusals = steps.filter((s) => s.kind === "refuse").length;
  return (
    <div className={styles.wrap}>
      <Pill>Déroulé · {count(steps.length, "étape")}{refusals ? ` · ${count(refusals, "refus", "refus")}` : ""}</Pill>
      <ol className={styles.list}>
        {steps.map((s, i) => {
          const view = stepView(s, item.node.id, names);
          const sub = view.when ?? s.proof.text?.trim();
          return (
            <li key={`${s.proof.line}-${i}`} className={`${styles.step} ${i === selected ? styles.on : ""}`}>
              <button type="button" className={styles.pick} aria-pressed={i === selected} onClick={() => onSelect(i)}>
                <span className={styles.no}>{i + 1}</span>
                <span className={styles.title}>{view.title}</span>
                {sub && <code className={styles.sub}><Breakable text={sub} /></code>}
              </button>
              <span className={styles.chips}><StepChip step={s} item={item} model={model} names={names} /></span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
