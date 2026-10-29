import { useMemo } from "react";
import type { ScreenProps } from "../../app/ScreenProps";
import { screenHref } from "../../app/screens";
import { ScreenHeader } from "../../components/ScreenHeader";
import { StatusMessage } from "../../components/StatusMessage";
import { ViewTabs } from "../../components/ViewTabs";
import { contractsOf, findContract, usersOf } from "../../domain/contracts/list";
import { ContractPanel } from "./ContractPanel";
import { HowView } from "./HowView";
import { ProvidersView } from "./ProvidersView";
import { UsersView } from "./UsersView";
import styles from "./ContractsScreen.module.css";

const TABS = ["fonctionnement", "fournisseurs", "features"] as const;

/** `#/contrats/<contrat>/<vue>` : une interface et ses implémentations (maquette 27), lues dans le code. */
export function ContractsScreen({ project, map, params }: ScreenProps) {
  const { model } = map;
  const names = useMemo(() => new Map(model.nodes.map((n) => [n.id, n.name])), [model]);
  const all = contractsOf(model);
  const ref = findContract(model, params[0]);
  if (!all.length) return <StatusMessage title="Aucun contrat" detail="Aucune interface du dépôt n'est implémentée deux fois : rien ne choisit entre plusieurs fournisseurs." />;
  if (!ref) return <StatusMessage title="Contrat introuvable" detail={`${params[0]} n'est pas sur la carte actuelle.`} />;
  const { contract, node } = ref;
  const tab = TABS.find((t) => t === params[1]) ?? "fonctionnement";
  const users = usersOf(ref, model);
  const host = model.nodes.find((n) => n.id === node.parent);
  return (
    <div className={styles.screen}>
      <ScreenHeader
        crumbs={[{ label: project.name }, { label: "Contrats", href: screenHref("contrats") }, { label: contract.name }]}
        title={contract.name}
        lead={
          <span className={styles.lead}>
            <span className={styles.kind}>contrat</span>
            <span className={styles.dir}>{node.name}</span>
            {host && <span>· employé par {host.name}</span>}
          </span>
        }
        aside={<ViewTabs label="Vues du contrat" current={tab} href={(id) => screenHref("contrats", ref.id, id)} tabs={[
          { id: "fonctionnement", label: "Comment ça marche", icon: "contracts" },
          { id: "fournisseurs", label: "Fournisseurs", icon: "technologies", count: contract.implementations.length },
          { id: "features", label: "Features", icon: "features", count: users.length },
        ]} />}
      >
        {all.length > 1 && (
          <nav className={styles.others} aria-label="Autres contrats">
            {all.map((c) => <a key={c.id} href={screenHref("contrats", c.id)} className={c.id === ref.id ? styles.on : undefined} aria-current={c.id === ref.id ? "page" : undefined}>{c.contract.name}</a>)}
          </nav>
        )}
      </ScreenHeader>
      <div className={styles.body}>
        <div className={styles.main}>
          {tab === "fonctionnement" && <HowView subject={ref} map={map} names={names} />}
          {tab === "fournisseurs" && <ProvidersView subject={ref} model={model} />}
          {tab === "features" && <UsersView users={users} />}
        </div>
        <ContractPanel subject={ref} model={model} tech={map.tech} users={users.length} />
      </div>
    </div>
  );
}
