import type { lifecycle } from "../../model/data";
import { Rep } from "../../lang/Rep";
import { State } from "../../lang/objects";
import { Arrow } from "../../lang/marks";
import { Ref } from "../../ui/Ref";
import { Rich } from "../../ui/Rich";

/**
 * T1, le cycle de vie : l'état de départ, chaque écriture vers un état avec sa fonction et sa ligne, une écriture
 * calculée vers tous les états qu'elle peut poser, les états jamais écrits. Le même dessin dans Données et dans la vue d'une table.
 */
export function Lifecycle({ name, life }: { name: string; life: NonNullable<ReturnType<typeof lifecycle>> }) {
  const rows = Math.max(1, life.steps.length + (life.anyOf.length ? 1 : 0));
  const anyRow = life.steps.length + 1;
  return (
    <Rep code="T1" name="Cycle de vie" question="Par quels états passe cette donnée ?" sentence={<Rich text={life.sentence} />}
      reads={<>en suivant les flèches : chacune est une écriture de <code>{name}.{life.field.name}</code>, avec la fonction et la ligne qui la font{life.start ? ", depuis l'état que la base pose à la création" : ""}. En rouge, une valeur calculée : rien n'interdit un passage. En pointillé, un état permis que rien n'écrit.</>}>
      <div className="dx__life">
        <div className="dx__start" style={{ gridRow: `1 / span ${rows}` }}>{life.start ? <><State value={life.start} /><small>posé par la base</small></> : <small>écrit par le code</small>}</div>
        {life.steps.map((s, i) => [
          <div key={`a${s.value}`} className="dx__arrow" style={{ gridRow: i + 1 }}><Arrow kind="write" label={s.fns.slice(0, 2).join(", ") || "écrit"} /></div>,
          <div key={`s${s.value}`} className="dx__to" style={{ gridRow: i + 1 }}><State value={s.value} /><Ref proof={s.proof} /></div>,
        ])}
        {life.anyOf.length > 0 && [
          <div key="a*" className="dx__arrow dx__arrow--any" style={{ gridRow: anyRow }}><Arrow kind="write" label={`${life.open.fns.slice(0, 2).join(", ") || "écrit"}, valeur calculée`} /></div>,
          <div key="s*" className="dx__to dx__to--any" style={{ gridRow: anyRow }}>
            <span className="dx__anyof">{life.anyOf.map((v) => <State key={v} value={v} />)}</span>
            <Ref proof={life.open.proofs[0]!} />
          </div>,
        ]}
        {life.never.length > 0 && <div className="dx__never" style={{ gridRow: rows + 1 }}>{life.never.map((v) => <State key={v} value={`${v}, jamais écrit`} never />)}</div>}
      </div>
    </Rep>
  );
}
