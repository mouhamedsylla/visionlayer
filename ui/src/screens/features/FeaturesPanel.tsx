import { PanelCard } from "../../components/panel/PanelCard";
import { PanelStats } from "../../components/panel/PanelStats";
import { RouteMethod } from "../../components/RouteKey";
import { PanelNote, PanelSection, SidePanel } from "../../components/SidePanel";
import { TechMark } from "../../components/TechText";
import type { EntryGroup } from "../../domain/features/list";
import { methodCounts } from "../../domain/features/methods";
import { count } from "../../domain/text/plural";

/**
 * Le panneau de la liste : ses chiffres, pourquoi il n'y a pas encore de
 * feature, et les regroupements que VisionLayer propose à la place, chacun
 * avec ses méthodes. Il ne nomme rien : un nom de feature et son but viennent
 * d'une personne ou d'un agent.
 */
export function FeaturesPanel({ groups }: { groups: EntryGroup[] }) {
  const all = groups.flatMap((g) => g.entries);
  const routes = all.filter((r) => r.entry.kind === "http").length;
  const stats = [
    { n: all.length, label: all.length > 1 ? "points d'entrée" : "point d'entrée" },
    { n: routes, label: routes > 1 ? "routes" : "route" },
    { n: all.length - routes, label: "sans clic" },
  ];
  return (
    <SidePanel label="Features">
      <PanelStats items={stats} />
      <PanelSection title="Aucune feature déclarée">
        <PanelNote>
          VisionLayer ne sait pas ce qu'est une feature pour tes utilisateurs. Il lit ce que fait chaque point d'entrée ; le nom et le but d'une feature
          se déclarent dans une fiche, par l'agent qui la construit ou par toi.
        </PanelNote>
      </PanelSection>
      <PanelSection title={`Regroupements proposés · ${groups.length}`}>
        <PanelNote>Les routes par ressource, avec leurs méthodes, puis ce qui tourne sans clic.</PanelNote>
        {groups.map((g) => {
          const methods = methodCounts(g.entries);
          return (
            <PanelCard key={g.id} kind={g.entries[0]?.entry.kind === "http" ? undefined : g.reason} title={g.title.startsWith("/") ? <TechMark piece={{ text: g.title, kind: "code" }} /> : g.title}
              chips={methods.length ? methods.map((m) => <><RouteMethod routeKey={`${m.method} /`} />×{m.n}</>) : [count(g.entries.length, "point d'entrée", "points d'entrée")]} />
          );
        })}
      </PanelSection>
      <PanelSection title="Ce qui est calculé" open={false}>
        <PanelNote>
          Pour les {all.length} points d'entrée : ce qu'ils lisent, écrivent, appellent et mettent en file, leurs refus et leurs réponses, dans l'ordre du code.
          Ouvre une ligne pour son déroulé.
        </PanelNote>
      </PanelSection>
    </SidePanel>
  );
}
