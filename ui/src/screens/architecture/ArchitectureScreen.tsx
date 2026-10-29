import type { ScreenProps } from "../../app/ScreenProps";
import { BlockScreen } from "../block/BlockScreen";
import { MapScreen } from "./MapScreen";

/** `#/architecture` : la carte ; `#/architecture/<bloc>` : l'intérieur d'un bloc. */
export function ArchitectureScreen({ project, map, params }: ScreenProps) {
  const nodeId = params[0];
  return nodeId ? <BlockScreen project={project} map={map} nodeId={nodeId} /> : <MapScreen project={project} map={map} />;
}
