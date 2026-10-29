import { basename } from "node:path";
import { FactBase } from "../facts/base.js";
import { loadPacks } from "../facts/packs.js";
import { assemble } from "../facts/assemble.js";
import type { ArchModelV2 } from "../arch/types.js";
import { mapChanges } from "./changes.js";
import { techLabel } from "./icons.js";
import type { MapPayload, TechLabel } from "./types.js";

function techLabels(model: ArchModelV2): Record<string, TechLabel> {
  const ids = new Set(model.nodes.flatMap((n) => n.tech ?? []));
  return Object.fromEntries([...ids].sort().map((id) => [id, techLabel(id)]));
}

/**
 * La carte v2 d'un dépôt, gardée en mémoire. Elle est calculée au démarrage,
 * puis seulement quand un humain demande la mise à jour : une lecture de
 * l'interface ne relance jamais l'analyse. La carte précédente sert à dire
 * ce qui a changé ; rien n'est écrit sur le disque.
 */
export class MapSource {
  private base?: FactBase;
  private current?: MapPayload;

  constructor(private readonly root: string) {}

  async get(): Promise<MapPayload> {
    return this.current ?? this.refresh();
  }

  async refresh(): Promise<MapPayload> {
    const packs = await loadPacks();
    this.base ??= new FactBase(this.root, packs);
    const r = this.base.refresh();
    const model = assemble(this.base.database(), { name: basename(this.root), packs });
    const before = this.current;
    const changes = before ? { since: before.builtAt, items: mapChanges(before.model, model) } : undefined;
    this.current = { model, builtAt: new Date().toISOString(), reread: r.read.length, tech: techLabels(model), ...(changes ? { changes } : {}) };
    return this.current;
  }
}
