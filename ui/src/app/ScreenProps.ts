import type { MapPayload, ProjectInfo } from "../api/types";

/** Ce que chaque écran reçoit : le projet ouvert et sa carte. */
export interface ScreenProps {
  project: ProjectInfo;
  map: MapPayload;
  /** Ce qui suit l'écran dans l'adresse : `#/architecture/api` donne `["api"]`. */
  params: string[];
}
