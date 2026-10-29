import type { ArchModelV2 } from "../../api/types";
import { effectChips, effectsOf } from "../../domain/block/effects";
import { Icon } from "../../shell/icons";
import styles from "./EffectList.module.css";

/** Ce qu'un point d'entrée fait, verbe par verbe, avec ce qu'il touche : `écrit payments, sessions`, `appelle Stripe`. */
export function EffectList({ entryId, model, names }: { entryId: string; model: ArchModelV2; names: Map<string, string> }) {
  const chips = effectChips(effectsOf(entryId, model), names);
  if (!chips.length) return <span className={styles.none}>aucun effet lu</span>;
  return (
    <span className={styles.list}>
      {chips.map((c) => {
        const outward = c.kind === "request" || c.kind === "call";
        return (
          <span key={c.label} className={`${styles.effect} ${c.kind === "write" ? styles.write : ""}`}>
            {c.kind === "read" && <Icon name="read" size={11} />}
            {c.kind === "write" && <Icon name="write" size={11} />}
            <span className={styles.verb}>{c.label}</span>
            {!outward && <span className={styles.what}>{c.detail}</span>}
          </span>
        );
      })}
    </span>
  );
}
