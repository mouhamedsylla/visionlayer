import type { ArchModelV2, Entrypoint } from "../../api/types";
import { effectsOf } from "./effects";

/** Une ressource d'une API : les routes qui partagent leur premier segment, `/bookings`. */
export interface Resource {
  path: string;
  entries: Entrypoint[];
  /** Les tables (ou entités) lues et écrites par ses routes, et les services qu'elles appellent. */
  reads: string[];
  writes: string[];
  queues: string[];
  calls: string[];
}

/** `POST /bookings/:id/transfer` → la méthode, puis chaque segment, paramètre ou non. */
export function splitRoute(key: string): { method: string; segments: { text: string; param: boolean }[] } {
  const [method = "", path = ""] = key.includes(" ") ? key.split(/\s+/, 2) : ["", key];
  return { method, segments: path.split("/").filter(Boolean).map((s) => ({ text: s, param: s.startsWith(":") || s.startsWith("{") })) };
}

const uniq = (xs: string[]) => [...new Set(xs)].sort();

/** Les routes HTTP d'un bloc, rangées par ressource, dans l'ordre où le code les déclare. */
export function apiResources(entries: Entrypoint[], model: ArchModelV2, names: Map<string, string>): Resource[] {
  const groups = new Map<string, Entrypoint[]>();
  for (const e of entries.filter((x) => x.kind === "http")) {
    const first = splitRoute(e.key).segments[0]?.text ?? "";
    const path = `/${first}`;
    (groups.get(path) ?? groups.set(path, []).get(path)!).push(e);
  }
  return [...groups.entries()].map(([path, list]) => {
    const fx = list.flatMap((e) => effectsOf(e.id, model));
    const targets = (kinds: string[]) => uniq(fx.filter((f) => kinds.includes(f.kind)).map((f) => f.target ?? names.get(f.to) ?? f.to));
    return {
      path, entries: list,
      reads: targets(["read"]), writes: targets(["write"]), queues: targets(["message"]),
      calls: uniq(fx.filter((f) => f.kind === "request" || f.kind === "call").map((f) => names.get(f.to) ?? f.to)),
    };
  });
}

const GUARD: Record<NonNullable<Entrypoint["access"]>["level"], string> = {
  public: "publique", authenticated: "connexion", role: "rôle", signature: "signature", internal: "interne", unknown: "garde non reconnue",
};

/** La garde d'une route telle que le code la montre ; absente quand rien n'a été lu (ce n'est pas « publique »). */
export function guardLabel(e: Entrypoint): string | undefined {
  if (!e.access) return undefined;
  return e.access.level === "role" && e.access.roles?.length ? `rôle ${e.access.roles.join(", ")}` : GUARD[e.access.level];
}
