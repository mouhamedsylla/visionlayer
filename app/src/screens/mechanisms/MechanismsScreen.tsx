import { useState } from "react";
import type { MapPayload } from "../../api/types";
import { contracts, type ContractView } from "../../model/mechanisms";
import { plural } from "../../model/words";
import { Ref } from "../../ui/Ref";
import { Rep } from "../../lang/Rep";
import { Arrow } from "../../lang/marks";
import { Provenance } from "../../lang/marks";
import { Workspace } from "../../ui/Workspace";
import "./mechanisms.css";

/** Planche L6, Mécanismes : comment le système choisit ce qui s'exécute. Ici, les contrats (X3) et ce que le conteneur y branche. */
export function MechanismsScreen({ map, item, open }: { map: MapPayload; item?: string; open: (id: string) => void }) {
  const list = contracts(map);
  const v = list.find((x) => x.id === item) ?? list[0];
  const bound = list.filter((x) => x.impls.some((i) => i.bound.length)).length;
  const received = list.reduce((n, x) => n + x.consumers.length, 0);
  return (
    <Workspace
      head={<div className="mc__intro">
        <h1 className="mc__title">Comment le système choisit ce qui s'exécute</h1>
        <p className="mc__lead">Les contrats lus dans le code : une interface ou une classe abstraite, les classes qui la remplissent, ce qui choisit l'une d'elles, et qui la reçoit. Ce qu'un conteneur d'injection branche vient du pack de son framework.</p>
      </div>}
      panel={v && <Side v={v} />}>
      <div className="tiles">
        <div className="tile"><small>Contrats</small><b>{plural(list.length, "contrat", "contrats")}</b><span>interfaces et classes abstraites remplies au moins deux fois</span></div>
        <div className="tile"><small>Implémentations</small><b>{list.reduce((n, x) => n + x.impls.length, 0)}</b><span>classes qui remplissent un contrat</span></div>
        <div className="tile"><small>Branchés par un conteneur</small><b>{bound ? plural(bound, "contrat", "contrats") : "aucun lu"}</b><span>{bound ? "le framework donne l'implémentation" : "aucun pack ne lit d'injection ici"}</span></div>
        <div className="tile"><small>Reçus par</small><b>{received ? plural(received, "classe", "classes") : "aucune lue"}</b><span>qui reçoivent un contrat sans le construire</span></div>
      </div>
      {list.length === 0 && <section className="card"><p className="mc__empty">Aucun contrat lu : aucune interface ni classe abstraite du dépôt n'est remplie par deux classes.</p></section>}
      {list.length > 0 && <section className="card">
        <div className="mc__row mc__row--h"><span>Contrat</span><span>Implémentations</span><span>Branché par</span><span>Reçu par</span></div>
        {list.map((x) => (
          <button key={x.id} className={`mc__row${x === v ? " mc__row--on" : ""}`} onClick={() => open(x.id)}>
            <code>{x.c.name}</code><span>{x.impls.map((i) => i.name).join(", ")}</span>
            <span className={x.impls.some((i) => i.bound.length) ? "" : "q"}>{x.impls.some((i) => i.bound.length) ? "le conteneur" : x.c.selector ? x.c.selector.symbol.name : "non lu"}</span>
            <span className={x.consumers.length ? "" : "q"}>{x.consumers.length ? x.consumers.map((k) => k.name).join(", ") : "aucune classe lue"}</span>
          </button>
        ))}
      </section>}
      {v && <Contract v={v} />}
    </Workspace>
  );
}

/** X3 : le contrat au centre, chaque implémentation sur sa ligne avec ce qui la choisit, ceux qui le reçoivent à gauche. */
function Contract({ v }: { v: ContractView }) {
  const { c } = v;
  return (
    <Rep code="X3" name="Contrat" question="Quelle implémentation répond ?" sentence={v.sentence}
      reads="de gauche à droite : qui reçoit le contrat, le contrat, puis chaque implémentation sur sa ligne avec l'endroit où le conteneur la branche, ou la valeur qui la choisit. Pointillé : jamais branchée d'après ce qui est lu.">
      <div className="mc__fig">
        <div className="mc__top">
          {v.consumers.length > 0 && <div className="mc__recv">{v.consumers.map((k) => <div key={k.name + k.proof.path} className="mc__k"><b>{k.name}</b><Ref proof={k.proof} /></div>)}</div>}
          {v.consumers.length > 0 && <Arrow kind="call" label="reçoit" />}
          <div className="mc__iface"><b>{c.name}</b><small>{plural(c.operations.length, "opération", "opérations")}</small><Ref proof={{ path: c.interface.path, line: c.interface.line }} /></div>
          {v.consumers.length === 0 && <span className="mc__none">aucune classe ne le reçoit d'un conteneur, d'après ce qui est lu</span>}
        </div>
        <table className="mc__tbl">
          <thead><tr>{c.selector && <th className="mc__c1">Choisie quand</th>}<th className="mc__c2">Branchée dans</th><th className="mc__arrow" /><th>Implémentation</th></tr></thead>
          <tbody>
            {v.impls.map((i) => (
              <tr key={i.name}>
                {c.selector && <td>{i.when ? <code className="mc__when">{i.when === "sinon" ? "sinon" : i.when}</code> : <span className="q">non lu</span>}</td>}
                <td>{i.bound.length ? i.bound.map((b) => <Ref key={b.path + b.line} proof={b} />) : <span className="q">non lu</span>}</td>
                <td className="mc__arrow"><Arrow kind="call" /></td>
                <td><div className={`mc__cls${i.bound.length || i.when ? "" : " mc__cls--o"}`}><b>{i.name}</b><Ref proof={i.proof} />{i.packages.length > 0 && <small>emploie {i.packages.join(", ")}</small>}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Rep>
  );
}

function Side({ v }: { v: ContractView }) {
  const { c } = v;
  const packs = [...new Set([...(c.bindings ?? []), ...v.consumers].map((x) => x.proof.pack).filter(Boolean))];
  return (
    <aside className="mc__side">
      <section className="night">
        <div className="ax__nhead">
          <span className="lbl">Contrat choisi</span>
          <h2>{c.name}</h2>
          <p className="sub">{c.interface.path}:{c.interface.line}</p>
        </div>
        {c.summary && <p className="sub">{c.summary.text}</p>}
        <span className="lbl">Ce qu'il promet</span>
        <div className="mc__ops">
          {c.operations.map((o) => <div key={o.name}><b>{o.name}</b><span>ligne {o.line}</span></div>)}
        </div>
      </section>
      <section className="card">
        <div className="hd"><h2>Comment c'est trouvé</h2></div>
        <p className="mc__how">Le contrat et ses implémentations sont lus dans la syntaxe : <code>implements</code>, une interface ou une classe abstraite. {packs.length ? <>Ce que le conteneur branche, et qui le reçoit, vient de la capture {packs.map((p) => <b key={p}>{p}</b>)}.</> : "Aucune capture ne dit ici ce que branche un conteneur."}</p>
        <div className="mc__prov"><Provenance kind="read" /></div>
      </section>
    </aside>
  );
}
