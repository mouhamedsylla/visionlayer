import type { ArchModelV2 } from "../../api/types";
import { screenHref } from "../../app/screens";
import { PanelCard } from "../../components/panel/PanelCard";
import { PanelStats } from "../../components/panel/PanelStats";
import { ProofRef } from "../../components/ProofRef";
import { PanelNote, PanelSection, PanelTitle, SidePanel } from "../../components/SidePanel";
import { TechMark } from "../../components/TechText";
import { callerGroups, fnCounts, functionNamed, type FnRef } from "../../domain/code/functions";
import { entryNature } from "../../domain/block/entries";
import { isBackground } from "../../domain/messages/triggers";
import type { Entrypoint } from "../../api/types";
import styles from "./FunctionPanel.module.css";

interface Props {
  item: FnRef;
  entry?: Entrypoint;
  model: ArchModelV2;
}

/** À côté de la fonction : ses chiffres, le point d'entrée qu'elle porte, qui l'appelle, ce qu'elle appelle, et comment c'est lu. */
export function FunctionPanel({ item, entry, model }: Props) {
  const { fn } = item;
  const c = fnCounts(fn);
  const callers = callerGroups(fn);
  const calls = fn.calls ?? [];
  const stats = [
    { n: c.steps, label: c.steps > 1 ? "étapes" : "étape" },
    { n: c.refusals, label: "refus" },
    { n: c.callers, label: c.callers > 1 ? "appels lus" : "appel lu" },
  ];
  return (
    <SidePanel label={`Autour de ${fn.name}`}>
      <PanelTitle kind={fn.exported ? "fonction exportée" : "fonction"} title={`${fn.name}()`} origin={<ProofRef proof={fn.proof} />} />
      <PanelStats items={stats} />
      {entry && (
        <PanelSection title="Point d'entrée">
          <PanelCard kind={entryNature(entry)} title={<TechMark piece={{ text: entry.key, kind: entry.kind === "http" ? "route" : "code" }} />}
            href={screenHref(isBackground(entry) ? "messages" : "features", entry.id)} proof={entry.proof} />
        </PanelSection>
      )}
      <PanelSection title={`Appelée par · ${callers.length}`} empty={entry ? "Aucun appel lu : elle est lancée par son point d'entrée." : "Aucun appel lu dans une fonction du dépôt. Un appel écrit dans une méthode de classe ou dans un rappel posé sur place n'est pas encore lu."}>
        {callers.map((g) => {
          const from = g.name ? functionNamed(model, g.path, g.name) : undefined;
          return (
            <PanelCard key={`${g.path}:${g.name ?? ""}`} kind={g.name ? "fonction" : "hors fonction"} title={g.name ? `${g.name}()` : g.path.split("/").pop()!}
              href={from ? screenHref("code", from.fn.id) : undefined} proof={{ path: g.path, line: g.lines[0]! }}
              chips={g.lines.length > 1 ? [`${g.lines.length} lignes`] : []} />
          );
        })}
      </PanelSection>
      <PanelSection title={`Appelle · ${calls.length}`} empty="Aucune fonction appelée par son nom.">
        {calls.length > 0 && (
          <div className={styles.calls}>
            {calls.map((x) => x.to
              ? <a key={x.name} className={styles.local} href={screenHref("code", x.to)}>{x.name}()</a>
              : <span key={x.name} className={styles.lib}>{x.name}()</span>)}
          </div>
        )}
        {calls.some((x) => !x.local) && <PanelNote>En bleu, les fonctions du dépôt, qui s'ouvrent ; les autres viennent d'une bibliothèque.</PanelNote>}
      </PanelSection>
      <PanelSection title="Comment c'est lu" open={false}>
        <PanelNote>
          Comme un point d'entrée qu'on lancerait seul : chaque étape vient d'une ligne de son code, dans l'ordre, les fonctions du dépôt dépliées.
          Les appelants sont les lignes qui la nomment, résolues jusqu'à sa déclaration ; un appel par une variable ou une méthode d'objet n'est pas compté.
          Les fichiers de test ne comptent pas.
        </PanelNote>
      </PanelSection>
    </SidePanel>
  );
}
