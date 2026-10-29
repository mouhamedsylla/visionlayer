import type { ComponentType } from "react";
import type { ArchModelV2 } from "../api/types";
import type { ScreenProps } from "./ScreenProps";
import { ArchitectureScreen } from "../screens/architecture/ArchitectureScreen";
import { CodeScreen } from "../screens/code/CodeScreen";
import { ContractsScreen } from "../screens/contracts/ContractsScreen";
import { DeployScreen } from "../screens/deploy/DeployScreen";
import { CoverageScreen } from "../screens/coverage/CoverageScreen";
import { DataScreen } from "../screens/data/DataScreen";
import { IdentityScreen } from "../screens/identity/IdentityScreen";
import { accessUnread } from "../domain/identity/guards";
import { FeaturesScreen } from "../screens/features/FeaturesScreen";
import { MessagesScreen } from "../screens/messages/MessagesScreen";
import { OverviewScreen } from "../screens/overview/OverviewScreen";
import { TechnologiesScreen } from "../screens/technologies/TechnologiesScreen";
import type { IconName } from "../shell/icons";

export interface ScreenEntry {
  id: string;
  label: string;
  group: "comprendre" | "suivre" | "bas";
  icon: IconName;
  /** Absent : l'écran n'est pas encore recodé, l'entrée est grisée. */
  component?: ComponentType<ScreenProps>;
  /** Pourquoi l'écran n'a rien à montrer sur ce projet : l'entrée reste ouvrable, grisée, avec la raison. */
  unread?: (model: ArchModelV2) => string | undefined;
}

/** L'adresse d'un écran, et d'un élément dedans : `#/architecture/api`. */
export function screenHref(id: string, ...params: string[]): string {
  return `#/${[id, ...params.map(encodeURIComponent)].join("/")}`;
}

/** `architecture/api` → l'écran `architecture` et `["api"]`. */
export function parseRoute(route: string): { id: string; params: string[] } {
  const [id = "", ...rest] = route.split("/");
  return { id, params: rest.map(decodeURIComponent) };
}

/** Les écrans de la barre latérale, dans l'ordre des maquettes. */
export const SCREENS: ScreenEntry[] = [
  { id: "vue", label: "Vue d'ensemble", group: "comprendre", icon: "overview", component: OverviewScreen },
  { id: "architecture", label: "Architecture", group: "comprendre", icon: "architecture", component: ArchitectureScreen },
  { id: "features", label: "Features", group: "comprendre", icon: "features", component: FeaturesScreen },
  { id: "donnees", label: "Données", group: "comprendre", icon: "data", component: DataScreen },
  { id: "contrats", label: "Contrats", group: "comprendre", icon: "contracts", component: ContractsScreen },
  { id: "messages", label: "Messages", group: "comprendre", icon: "messages", component: MessagesScreen },
  { id: "acces", label: "Accès", group: "comprendre", icon: "identity", component: IdentityScreen, unread: accessUnread },
  { id: "code", label: "Code", group: "comprendre", icon: "code", component: CodeScreen },
  { id: "technologies", label: "Technologies", group: "comprendre", icon: "technologies", component: TechnologiesScreen },
  { id: "deploiement", label: "Déploiement", group: "comprendre", icon: "deploy", component: DeployScreen },
  { id: "revues", label: "Revues", group: "suivre", icon: "reviews" },
  { id: "agents", label: "Agents", group: "suivre", icon: "agents" },
  { id: "connaissance", label: "Connaissance", group: "suivre", icon: "knowledge" },
  { id: "couverture", label: "Couverture", group: "suivre", icon: "coverage", component: CoverageScreen },
  { id: "reglages", label: "Réglages", group: "bas", icon: "settings" },
];

export const DEFAULT_SCREEN = "vue";

export function findScreen(id: string): ScreenEntry | undefined {
  return SCREENS.find((s) => s.id === id && s.component);
}
