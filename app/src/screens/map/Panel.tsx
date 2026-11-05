import type { ArchNode, KnowledgePayload, MapPayload } from "../../api/types";
import { blockLines } from "../../model/map";
import { sentence } from "../../model/overview";
import { blockQuestions, type Question } from "../../model/questions";
import { ROLE } from "../../model/words";
import { Ref } from "../../ui/Ref";
import { Rich } from "../../ui/Rich";

/**
 * Le panneau de la Carte (planche 03b) : ce qu'est le bloc, puis ce qu'on veut savoir de lui, une ligne par question.
 * Ni routes ni liens ici : les liens sont sur la carte, le reste a son écran.
 */
export function Panel({ map, knowledge, node, ask }: { map: MapPayload; knowledge?: KnowledgePayload; node: ArchNode; ask: (q: Question) => void }) {
  const { questions, others } = blockQuestions(map, knowledge, node);
  const kind = `${ROLE[node.role]}${node.instances && node.instances.min > 1 ? ` × ${node.instances.min}` : ""}`;
  const line = blockLines(node, map.tech).join(", ");
  return (
    <aside className="vl-card mp__panel" aria-label="Selected block">
      <div className="vl-card__head"><span className="vl-label">Selected block</span><span className="mono mp__kind">{kind}</span></div>
      <div className="mp__pintro">
        <p className="mp__pname">{node.name}</p>
        {line && <p className="mp__pline">{line}</p>}
        {node.proof[0] && node.proof[0].line > 0 && <Ref proof={node.proof[0]} className="mp__pref" />}
      </div>
      {questions.length > 0 && <div className="mp__psec"><span className="vl-label">Details</span></div>}
      {questions.map((q) => (
        <button key={q.id} className={`mp__q${q.off ? " mp__q--off" : ""}`} onClick={() => ask(q)}>
          <b>{q.text}{q.mark && <span className={`mk mk--${q.mark.tone} mp__qmark`}>{q.mark.text}</span>}</b>
          <span className="mp__qgo" />
          <small><Rich text={q.fact} /></small>
        </button>
      ))}
      {others.length > 0 && <div className="mp__psec mp__psec--row"><span className="vl-label">Findings</span><span className="mono mp__kind">{others.length}</span></div>}
      {others.slice(0, 6).map((f, i) => (
        <div key={i} className="mp__pfact">
          <span className="mp__pplus">!</span>
          <div className="mp__pfactbody"><p className="mp__pfacttext"><Rich text={sentence(f.message)} /></p>{f.proof[0] && <Ref proof={f.proof[0]} />}</div>
        </div>
      ))}
      {!questions.length && <p className="mp__pempty">Links on the map.</p>}
    </aside>
  );
}
