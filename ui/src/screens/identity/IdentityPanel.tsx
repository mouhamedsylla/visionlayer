import type { MapPayload } from "../../api/types";
import { useSource } from "../../api/useSource";
import { screenHref } from "../../app/screens";
import { CodeExcerpt } from "../../components/CodeExcerpt";
import { ProofRef } from "../../components/ProofRef";
import { PanelReach, reachCount } from "../../components/panel/PanelReach";
import { PanelStats } from "../../components/panel/PanelStats";
import { PanelAction, PanelItem, PanelNote, PanelSection, PanelTitle, SidePanel } from "../../components/SidePanel";
import { TechText } from "../../components/TechText";
import { LEVEL_LABEL } from "../../domain/identity/facts";
import type { GuardedEntry, GuardFn } from "../../domain/identity/guards";

const HOW = "Une garde est une fonction du dépôt qui refuse en 401 (connexion) ou 403 (rôle), ou qui en appelle une, posée sur la route, sur son routeur avant elle, ou appelée par son code. Une route lue sans garde est dite publique ; une entrée qu'aucun pack ne sait garder n'a pas de garde du tout.";

interface Props {
  item?: GuardedEntry;
  guard?: GuardFn;
  map: MapPayload;
  names: Map<string, string>;
}

/** La route choisie, ou à défaut la garde la plus employée : son code, ses refus, et ce qu'elle laisse passer. */
export function IdentityPanel({ item, guard, map, names }: Props) {
  const fn = item ? undefined : guard?.fn;
  const call = item?.entry.flow?.find((s) => s.kind === "invoke" && s.depth === 0 && s.name === item.entry.access?.by?.name);
  const span = item ? { path: (call ?? item.entry).proof.path, from: Math.max(1, (call ?? item.entry).proof.line - 2), to: (call ?? item.entry).proof.line + 4 }
    : fn ? { path: fn.proof.path, from: fn.proof.line, to: fn.end } : undefined;
  const source = useSource(span, map.builtAt);
  if (!item && !guard) return null;
  const excerpt = source?.status === "ready" && <CodeExcerpt excerpt={source.excerpt} marks={call ? [call.proof.line] : (fn?.flow ?? []).filter((s) => s.kind === "refuse").map((s) => s.proof.line)} marksLabel={call ? "la garde" : "refus"} />;
  if (item) {
    const { entry } = item;
    const level = LEVEL_LABEL[entry.access!.level];
    return (
      <SidePanel label={entry.key}>
        <PanelTitle kind={level.short} title={entry.key} origin={entry.access?.by ? <TechText text={`gardée par ${entry.access.by.name}()`} /> : level.title} />
        <PanelStats items={[{ n: item.writes.length, label: "écritures" }, { n: item.checks.length, label: "vérifications" }, { n: entry.flow?.length ?? 0, label: "étapes" }]} />
        {excerpt}
        {item.checks.length > 0 && (
          <PanelSection title={`Vérifié dans la route · ${item.checks.length}`}>
            {item.checks.map((c, i) => <PanelItem key={i} title={`${c.status}${c.code ? ` · ${c.code}` : ""}`}><span><TechText text={`si ${c.when}`} /></span><ProofRef proof={c.proof} /></PanelItem>)}
          </PanelSection>
        )}
        {reachCount(entry, names) > 0 && <PanelSection title={`Ce qu'elle atteint · ${reachCount(entry, names)}`}><PanelReach entry={entry} names={names} /></PanelSection>}
        <PanelAction href={screenHref("features", entry.id)}>Voir son déroulé, étape par étape</PanelAction>
        <PanelSection title="Comment c'est trouvé" open={false}><PanelNote>{HOW}</PanelNote></PanelSection>
      </SidePanel>
    );
  }
  const g = guard!;
  return (
    <SidePanel label={g.ref.name}>
      <PanelTitle kind={`garde · ${LEVEL_LABEL[g.level].short}`} title={`${g.ref.name}()`} origin={<ProofRef proof={g.ref} />} />
      <PanelStats items={[{ n: g.entries.length, label: "routes gardées" }, { n: g.refusals.length, label: "refus" }, { n: g.reads.length, label: "lectures" }]} />
      {excerpt}
      <PanelSection title={`Ses refus · ${g.refusals.length}`}>
        {g.refusals.map((r, i) => <PanelItem key={i} title={`${r.status}${r.code ? ` · ${r.code}` : ""}`}>{r.when && <span><TechText text={`si ${r.when}`} /></span>}<ProofRef proof={r.proof} /></PanelItem>)}
      </PanelSection>
      {g.reads.length > 0 && (
        <PanelSection title={`Ce qu'elle lit · ${g.reads.length}`}>
          {g.reads.map((r) => <PanelItem key={`${r.node}:${r.entity}`} title={<TechText text={r.entity} />}><span>dans {names.get(r.node) ?? r.node}</span></PanelItem>)}
        </PanelSection>
      )}
      <PanelSection title="Comment c'est trouvé" open={false}><PanelNote>{HOW}</PanelNote></PanelSection>
    </SidePanel>
  );
}
