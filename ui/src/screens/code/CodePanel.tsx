import type { ArchModelV2 } from "../../api/types";
import { screenHref } from "../../app/screens";
import { PanelCard } from "../../components/panel/PanelCard";
import { PanelStats } from "../../components/panel/PanelStats";
import { PanelNote, PanelSection, SidePanel } from "../../components/SidePanel";
import { allFunctions, fnCounts } from "../../domain/code/functions";

const TOP = 5;

/** À côté de la liste : les chiffres du code lu, les fonctions que le plus de lignes appellent, et comment c'est lu. */
export function CodePanel({ model }: { model: ArchModelV2 }) {
  const all = allFunctions(model);
  const files = new Set(all.map((r) => r.fn.proof.path)).size;
  const blocks = new Set(all.map((r) => r.node.id)).size;
  const most = all.filter((r) => (r.fn.calledFrom?.length ?? 0) > 1)
    .sort((a, b) => (b.fn.calledFrom?.length ?? 0) - (a.fn.calledFrom?.length ?? 0)).slice(0, TOP);
  return (
    <SidePanel label="Code">
      <PanelStats items={[
        { n: all.length, label: all.length > 1 ? "fonctions" : "fonction" },
        { n: files, label: files > 1 ? "fichiers" : "fichier" },
        { n: blocks, label: blocks > 1 ? "blocs" : "bloc" },
      ]} />
      <PanelSection title={`Les plus appelées · ${most.length}`} empty="Aucune fonction appelée par plus d'une ligne.">
        {most.map(({ fn, node }) => {
          const c = fnCounts(fn);
          return (
            <PanelCard key={fn.id} kind={`${node.name} · ${fn.proof.path.split("/").pop()}`} title={`${fn.name}()`} href={screenHref("code", fn.id)}
              chips={[`appelée ${c.callers} fois`, ...(c.refusals ? [`${c.refusals} refus`] : [])]} />
          );
        })}
      </PanelSection>
      <PanelSection title="Comment c'est lu" open={false}>
        <PanelNote>
          Chaque fonction de premier niveau d'un fichier lu, hors tests, ouverte comme un point d'entrée qu'on lancerait seul. Elle est ici si elle fait
          quelque chose de visible (lire, écrire, appeler, refuser) ou si une ligne du dépôt l'appelle. Une méthode de classe n'est pas encore ouverte seule.
        </PanelNote>
      </PanelSection>
    </SidePanel>
  );
}
