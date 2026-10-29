import type { KnowledgeClaim, KnowledgePayload } from "../../api/types";
import { PanelStats } from "../../components/panel/PanelStats";
import { PanelNote, PanelSection, SidePanel } from "../../components/SidePanel";
import { outdated, upToDate } from "../../domain/coverage/measure";
import { TechRows } from "../technologies/TechRows";

const STATE = { stale: "le code ancré a changé", contradicted: "la vérification échoue", orphan: "code ancré introuvable" } as const;

function ClaimRow({ claim }: { claim: KnowledgeClaim }) {
  const at = claim.anchors.find((a) => a.at)?.at;
  const proof = at ? { path: at.path, line: at.line } : { path: claim.file, line: claim.line };
  return <TechRows label={`${claim.id} · ${STATE[claim.state as keyof typeof STATE]}`} code={claim.text} where={`${proof.path}:${proof.line}`} proof={proof} />;
}

/** À côté : l'état des notes, celles à relire (d'abord celles qui le sont devenues depuis le démarrage), et qui comble les trous. */
export function CoveragePanel({ claims, payload }: { claims: KnowledgeClaim[]; payload: KnowledgePayload }) {
  const stale = claims.filter(outdated);
  const since = new Set(payload.sinceStart);
  const recent = stale.filter((c) => since.has(c.id));
  const older = stale.filter((c) => !since.has(c.id));
  return (
    <SidePanel label="Couverture">
      <PanelStats items={[
        { n: claims.length, label: claims.length > 1 ? "notes" : "note" },
        { n: claims.filter(upToDate).length, label: "à jour" },
        { n: stale.length, label: "à relire" },
      ]} />
      {claims.length === 0 && (
        <PanelNote>
          Aucune note déclarée dans <code>.vision/knowledge/</code>. Une note dit ce que le code ne dit pas (une règle, une raison, une garantie) et s'ancre sur la ligne qui la porte :
          quand cette ligne change, la note redevient à relire.
        </PanelNote>
      )}
      {recent.length > 0 && (
        <PanelSection title={`À relire depuis le démarrage · ${recent.length}`}>
          {recent.map((c) => <ClaimRow key={c.id} claim={c} />)}
        </PanelSection>
      )}
      {claims.length > 0 && (
        <PanelSection title={`${recent.length ? "Déjà à relire" : "À relire"} · ${older.length}`} empty="Aucune : chaque note est à jour contre le code d'aujourd'hui.">
          {older.map((c) => <ClaimRow key={c.id} claim={c} />)}
        </PanelSection>
      )}
      {payload.report.errors.length > 0 && (
        <PanelSection title={`Fichiers de notes illisibles · ${payload.report.errors.length}`}>
          {payload.report.errors.map((e) => <TechRows key={e.file} label={e.message} where={e.file} />)}
        </PanelSection>
      )}
      <PanelSection title="Qui comble les trous" open={false}>
        <PanelNote>
          Un humain qui répond, ou l'agent qui travaille sur la tâche : la note s'écrit dans <code>.vision/knowledge/</code>, relue comme le code. Une note à relire
          n'est pas fausse pour autant : la ligne qu'elle cite a changé, quelqu'un doit la relire. VisionLayer ne lance pas d'agent pour ça.
        </PanelNote>
      </PanelSection>
    </SidePanel>
  );
}
