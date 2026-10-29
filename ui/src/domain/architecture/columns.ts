import type { NodeRole } from "../../api/types";

export type ColumnId = "opened" | "server" | "used";

export interface Column {
  id: ColumnId;
  title: string;
  hint: string;
}

/** Les trois couloirs de la carte, de qui déclenche à ce qui est utilisé. */
export const COLUMNS: Column[] = [
  { id: "opened", title: "Ce que les gens ouvrent", hint: "apps et clients" },
  { id: "server", title: "Ce qui tourne côté serveur", hint: "services, workers, tâches" },
  { id: "used", title: "Ce qu'ils utilisent", hint: "données, files, services externes" },
];

/** L'ordre des rôles dans un couloir, puis le couloir de chaque rôle. */
export const ROLE_ORDER: NodeRole[] = [
  "actor", "app",
  "service", "function", "worker", "job", "binary", "module", "layer", "adapter",
  "store", "channel", "managed", "external",
];

const COLUMN_OF: Record<NodeRole, ColumnId> = {
  actor: "opened", app: "opened",
  service: "server", function: "server", worker: "server", job: "server", binary: "server",
  module: "server", layer: "server", adapter: "server",
  store: "used", channel: "used", managed: "used", external: "used",
};

export function columnOf(role: NodeRole): ColumnId {
  return COLUMN_OF[role];
}

/** Les rôles qui s'exécutent : ce qu'on déploie et lance, par opposition à ce qu'on utilise. */
export function isRunning(role: NodeRole): boolean {
  return columnOf(role) !== "used" && role !== "actor";
}
