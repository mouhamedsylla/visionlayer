import { join } from "node:path";
import { MapSource } from "../../vision/web/map-source";
import type { MapPayload } from "../src/api/types";

/** La carte d'atelier-api (corpus d'apprentissage), calculée comme le fait le serveur. */
let cached: Promise<MapPayload> | undefined;
export function atelierMap(): Promise<MapPayload> {
  cached ??= new MapSource(join(import.meta.dirname, "..", "..", "tests", "corpus", "atelier-api")).get();
  return cached;
}
