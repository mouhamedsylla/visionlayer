import type { ReactNode } from "react";
import type { EdgeKind } from "../api/types";

/** Les marques du langage visuel (planche L1), accolées au fait qu'elles qualifient. */

/** Effet : ce qu'une étape fait au système. Écrire est plein, lire à filet, la mise en file pointillée, un refus porte son code. */
export function Effect({ kind, what }: { kind: EdgeKind | "refuse"; what: string }) {
  const word: Record<string, string> = { write: "Écrit", read: "Lit", request: "Appelle", call: "Appelle", message: "Met en file", trigger: "Déclenche", use: "Emploie", refuse: "Refuse" };
  return <span className={`lx-fx lx-fx--${kind}`}>{word[kind] ?? kind} {what}</span>;
}

/** Étape : le même numéro dans le déroulé et en marge du code. */
export const Step = ({ n, tone }: { n: number; tone?: "refuse" | "quiet" }) => <span className={`lx-step${tone ? ` lx-step--${tone}` : ""}`}>{n}</span>;

/** Moment : un groupe d'étapes titré, qui se replie. */
export function Moment({ title, count, open, toggle, children }: { title: string; count: number; open: boolean; toggle: () => void; children: ReactNode }) {
  return (
    <div className="lx-moment">
      <button className="lx-moment__head" onClick={toggle}><span className="vl-label">{title}</span><span className="lx-moment__n">{count} étape{count > 1 ? "s" : ""} {open ? "▾" : "▸"}</span></button>
      {open && children}
    </div>
  );
}

/** Cadre de cohérence : pointillé autour des étapes qu'il protège (transaction, verrou, clé d'idempotence). */
export const Frame = ({ label, children }: { label: string; children: ReactNode }) =>
  <div className="lx-frame"><span className="vl-tag vl-tag--neutral lx-frame__tag">{label}</span>{children}</div>;

/** Provenance : d'où vient un fait. Rien ne vient du modèle de langage. */
export function Provenance({ kind, who }: { kind: "read" | "declared" | "proposed" | "unread"; who?: string }) {
  const text = { read: "lu dans le code", declared: `déclaré${who ? `, ${who}` : ""}`, proposed: "proposé, pack non chargé", unread: "non lu" }[kind];
  return <span className={`lx-prov lx-prov--${kind}`}><i />{text}</span>;
}

/** Gravité : toujours un libellé ; la couleur seule ne dit rien. */
export const Gravity = ({ tone }: { tone: "critical" | "signal" | "live" }) =>
  <span className={`vl-tag vl-tag--${tone}`}>{{ critical: "Constat", signal: "À surveiller", live: "Vérifié" }[tone]}</span>;
