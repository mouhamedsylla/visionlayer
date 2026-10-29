import type { ArchModelV2, TechLabel } from "../../api/types";
import { ProofRef } from "../../components/ProofRef";
import { PanelStats } from "../../components/panel/PanelStats";
import { PanelVars } from "../../components/panel/PanelVars";
import { PanelNote, PanelSection, PanelTitle, SidePanel } from "../../components/SidePanel";
import { selectorEnv, type ContractRef } from "../../domain/contracts/list";
import { PanelChoices } from "./PanelChoices";
import { PanelPackages } from "./PanelPackages";

interface Props {
  subject: ContractRef;
  model: ArchModelV2;
  tech: Record<string, TechLabel>;
  /** Combien de points d'entrée finissent par l'employer. */
  users: number;
}

/** À côté du contrat : ses chiffres, qui choisit l'implémentation, les variables lues, ce qui reste dans le module, et comment c'est lu. */
export function ContractPanel({ subject, model, tech, users }: Props) {
  const { contract, node } = subject;
  const env = selectorEnv(subject, model);
  const sealed = contract.sealed;
  const stats = [
    { n: contract.operations.length, label: contract.operations.length > 1 ? "opérations" : "opération" },
    { n: contract.implementations.length, label: contract.implementations.length > 1 ? "implémentations" : "implémentation" },
    { n: users, label: users > 1 ? "features" : "feature" },
  ];
  return (
    <SidePanel label="Autour du contrat">
      <PanelTitle kind="contrat" title={contract.name} origin={<ProofRef proof={contract.interface} />} />
      <PanelStats items={stats} />
      {contract.selector && (
        <PanelSection title={`Qui choisit · ${contract.selector.choices?.length ?? 0}`}>
          {contract.selector.choices?.length
            ? <PanelChoices selector={contract.selector} />
            : <PanelNote>{contract.selector.symbol.name}() ne dit pas quelle valeur mène à quelle implémentation.</PanelNote>}
        </PanelSection>
      )}
      {env.length > 0 && (
        <PanelSection title={`Variables lues · ${env.length}`}>
          <PanelNote>Noms seulement, jamais les valeurs.</PanelNote>
          <PanelVars vars={env} />
        </PanelSection>
      )}
      {sealed && (
        <PanelSection title={`Reste dans ${node.name} · ${sealed.packages.length}`}>
          <PanelPackages sealed={sealed} tech={tech} />
        </PanelSection>
      )}
      <PanelSection title="Comment c'est lu" open={false}>
        <PanelNote>
          Une interface du dépôt implémentée au moins deux fois. Ses champs et leurs commentaires viennent de sa déclaration ; ce que fait chaque
          implémentation, des appels de sa méthode ; qui choisit, des cas de la fonction qui la crée. La même lecture vaut pour un client de paiement,
          de stockage de fichiers ou d'IA. Ce qui n'est pas lu : quel fournisseur est réglé dans chaque environnement.
        </PanelNote>
      </PanelSection>
    </SidePanel>
  );
}
