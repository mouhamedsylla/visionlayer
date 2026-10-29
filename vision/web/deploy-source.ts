import { buildDeployModel } from "../deploy/build.js";
import { loadPacks } from "../facts/packs.js";
import { techLabel } from "./icons.js";
import type { DeployPayload } from "./types.js";

/**
 * Les chaînes de livraison du dépôt, lues en mémoire à la première demande,
 * puis seulement après une mise à jour de la carte demandée par un humain.
 * Rien n'est lancé ni écrit. Avec elles, le nom de chaque pack (pour dire
 * quel manifeste déclare une partie) et les logos qu'elles citent.
 */
export class DeploySource {
  private current?: DeployPayload;

  constructor(private readonly root: string) {}

  async get(builtAt: string): Promise<DeployPayload> {
    if (this.current?.builtAt === builtAt) return this.current;
    const deploy = buildDeployModel(this.root);
    const packs = Object.fromEntries((await loadPacks()).map((p) => [p.id, { name: p.name, tech: p.tech, ...(p.deploys ? { deploys: true } : {}) }]));
    const ids = new Set([...Object.values(packs).flatMap((p) => p.tech), ...deploy.pipelines.flatMap((p) => p.jobs.flatMap((j) => j.steps.flatMap((s) => (s.target ? [s.target] : []))))]);
    this.current = { deploy, packs, tech: Object.fromEntries([...ids].sort().map((id) => [id, techLabel(id)])), builtAt };
    return this.current;
  }

  /** Les workflows lus, s'ils l'ont été pour cette carte : l'aperçu de code peut les ouvrir. */
  cited(builtAt: string): Set<string> {
    return new Set(this.current?.builtAt === builtAt ? this.current.deploy.pipelines.map((p) => p.path) : []);
  }
}
