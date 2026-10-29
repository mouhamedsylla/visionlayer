import type { ContractFacet } from "../../api/types";
import { PanelSwitch } from "../../components/panel/PanelSwitch";

type Selector = NonNullable<ContractFacet["selector"]>;

/** Qui choisit, dessiné comme un aiguillage : la fonction en tête, puis chaque valeur et l'implémentation où elle mène. */
export function PanelChoices({ selector }: { selector: Selector }) {
  const ways = (selector.choices ?? []).map((c) => ({ when: c.when, target: c.implementation, proof: c.proof }));
  return <PanelSwitch head={`${selector.symbol.name}()`} proof={selector.symbol} ways={ways} />;
}
