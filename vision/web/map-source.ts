import { basename } from "node:path";
import { FactBase } from "../facts/base.js";
import { loadPacks } from "../facts/packs.js";
import { PackRegistry } from "../facts/registry.js";
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
  private registry?: PackRegistry;
  private current?: MapPayload;

  constructor(private readonly root: string) {}

  /** La base de faits de la dernière carte calculée (les appels, pour `vision_source`). */
  database() {
    return this.base?.database();
  }

  async get(): Promise<MapPayload> {
    return this.current ?? this.refresh();
  }

  async refresh(): Promise<MapPayload> {
    const packs = await loadPacks();
    this.base ??= new FactBase(this.root, packs);
    this.registry ??= new PackRegistry(this.root, packs);
    const r = this.base.refresh();
    // Les packs locaux posés, modifiés ou retirés depuis le dernier calcul : chargés ou retirés à chaud (ADR 0019).
    this.base = await this.registry.sync(this.base);
    const model = assemble(this.base.database(), { name: basename(this.root), packs: [...this.base.packs] });
    const before = this.current;
    const changes = before ? { since: before.builtAt, items: mapChanges(before.model, model) } : undefined;
    const localPacks = this.registry.states();
    const files = this.base.database().get("file").map((t) => String(t.args[0])).sort();
    const used = new Set<string>();
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) { v.forEach(walk); return; }
      if (!v || typeof v !== "object") return;
      const o = v as Record<string, unknown>;
      if (typeof o.pack === "string") used.add(o.pack);
      Object.values(o).forEach(walk);
    };
    walk(model);
    this.current = { model, builtAt: new Date().toISOString(), reread: r.read.length, tech: techLabels(model), files, packs: [...used].sort(), ...(changes ? { changes } : {}), ...(localPacks.length ? { localPacks } : {}) };
    return this.current;
  }
}
