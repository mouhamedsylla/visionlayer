import type { RaceView } from "../../model/race";
import { Rep } from "../../lang/Rep";
import { Ref } from "../../ui/Ref";
import { Rich } from "../../ui/Rich";

/** T2, la frise de course : deux couloirs, le temps de haut en bas, au centre la valeur de la donnée après chaque étape. */
export function Race({ race }: { race: RaceView }) {
  return (
    <Rep code="T2" name="Race timeline" question="What if two runs overlap?" sentence={<Rich text={race.sentence} />}
      reads="top to bottom, in time order. Left and right, the two runs; in the center, the data's value after each step. In red, the write nothing prevents.">
      <div className="rc">
        <span /><span className="vl-label">{race.left}</span><span /><span className="vl-label rc__mid">{race.subject}</span><span /><span className="vl-label rc__r">{race.right}</span>
        {race.steps.map((s, i) => [
          <span key={`n${i}`} className="rc__n">{i + 1}</span>,
          <span key={`l${i}`} className={`rc__t${s.bad && s.side === "l" ? " rc__t--bad" : ""}`}>{s.side === "l" && <>{s.text} <Ref proof={s.proof} /></>}</span>,
          <span key={`a${i}`} className={`rc__a${s.side === "l" ? ` rc__a--l${s.bad ? " rc__a--bad" : ""}` : ""}`} />,
          <span key={`v${i}`} className={`rc__v${s.bad ? " rc__v--bad" : ""}`}>{s.value}</span>,
          <span key={`b${i}`} className={`rc__a${s.side === "r" ? ` rc__a--r${s.bad ? " rc__a--bad" : ""}` : ""}`} />,
          <span key={`r${i}`} className={`rc__t rc__r${s.bad && s.side === "r" ? " rc__t--bad" : ""}`}>{s.side === "r" && <>{s.text} <Ref proof={s.proof} /></>}</span>,
        ])}
      </div>
      <p className="rc__verdict"><Rich text={race.verdict} /></p>
    </Rep>
  );
}
