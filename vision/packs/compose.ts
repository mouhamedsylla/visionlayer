import { posix } from "node:path";
import { LineCounter, parseDocument, isMap, isScalar, isSeq, type Node as YNode } from "yaml";
import type { PackScript } from "../facts/packs.js";
import type { FileFact } from "../facts/types.js";
import { dirOf, runTargets, sourceCandidates } from "./runs.js";

/**
 * Docker Compose, d'après son inventaire (docs/fonctionnement/packs/compose.md).
 *
 * unit(Fichier, Service, "service")          un service de la composition
 * unit_image(Fichier, Service, Image)        son image, sans registre ni version (postgres, redis)
 * unit_build(Fichier, Service, Dossier)      le dossier qu'il construit
 * unit_ctx(Fichier, Service, Préfixe)        ce dossier comme préfixe de chemin (`web/`, ou rien à la racine)
 * unit_dockerfile(Fichier, Service, Chemin)  le Dockerfile qu'il construit
 * unit_command(Fichier, Service)             il donne sa propre commande (ou son point d'entrée)
 * unit_runs(Fichier, Service, Cible)         le fichier que lance cette commande, depuis la composition ou le contexte
 * unit_instances(Fichier, Service, N)        deploy.replicas, scale
 * unit_env_name(Fichier, Service, Nom)       une variable d'environnement, par son nom seulement
 *
 * Les fragments (`<<: *node`) sont résolus : la valeur vient du fragment, la ligne du service quand elle n'est pas dans le service.
 */
const script: PackScript = ({ file, fact }) => {
  const lc = new LineCounter();
  const doc = parseDocument(file.source, { lineCounter: lc, merge: true });
  const services = doc.get("services", true);
  if (!isMap(services)) return [];
  const all = (doc.toJS({ maxAliasCount: 100 }) as { services?: Record<string, Record<string, unknown>> }).services ?? {};
  const dir = dirOf(file.path);
  const lineOf = (n: unknown) => (n && typeof n === "object" && "range" in n && (n as YNode).range ? lc.linePos((n as YNode).range![0]).line : undefined);
  const out: FileFact[] = [];
  const join = (...p: string[]) => posix.normalize(p.filter(Boolean).join("/")).replace(/^\.$/, "");

  for (const pair of services.items) {
    const svc = isScalar(pair.key) ? String(pair.key.value) : undefined;
    const body = svc ? all[svc] : undefined;
    if (!svc || !body || typeof body !== "object") continue;
    const node = isMap(pair.value) ? pair.value : undefined;
    const keyLine = lineOf(pair.key) ?? 1;
    const at = (k: string) => lineOf(node?.get(k, true)) ?? keyLine;
    out.push(fact("unit", [file.path, svc, "service"], keyLine));

    if (typeof body.image === "string") {
      const name = body.image.split("@")[0]!.replace(/:[^/:]*$/, "").split("/").pop()!;
      out.push(fact("unit_image", [file.path, svc, name], at("image")));
    }

    const build = body.build;
    const ctxRaw = typeof build === "string" ? build : build && typeof build === "object" ? (build as Record<string, unknown>).context : undefined;
    if (build !== undefined) {
      const ctx = join(dir, typeof ctxRaw === "string" ? ctxRaw.replace(/^\.\//, "") : "");
      const df = build && typeof build === "object" && typeof (build as Record<string, unknown>).dockerfile === "string" ? String((build as Record<string, unknown>).dockerfile) : "Dockerfile";
      out.push(fact("unit_build", [file.path, svc, ctx], at("build")));
      out.push(fact("unit_ctx", [file.path, svc, ctx ? `${ctx}/` : ""], at("build")));
      out.push(fact("unit_dockerfile", [file.path, svc, join(ctx, df)], at("build")));
    }

    // Sa propre commande : le point d'entrée suivi des arguments ; le chemin, depuis la composition ou depuis le contexte.
    const words = (v: unknown) => (Array.isArray(v) ? v.map(String) : typeof v === "string" ? [v] : []);
    const cmd = [...words(body.entrypoint), ...words(body.command)];
    if (cmd.length) {
      const line = body.command !== undefined ? at("command") : at("entrypoint");
      out.push(fact("unit_command", [file.path, svc], line));
      const ctx = typeof ctxRaw === "string" ? join(dir, ctxRaw.replace(/^\.\//, "")) : dir;
      for (const base of new Set([dir, ctx])) for (const t of runTargets(cmd.join(" "), base)) {
        for (const c of [t, ...sourceCandidates(t)]) out.push(fact("unit_runs", [file.path, svc, c], line));
      }
    }

    const deploy = body.deploy as Record<string, unknown> | undefined;
    const replicas = typeof deploy?.replicas === "number" ? deploy.replicas : typeof body.scale === "number" ? body.scale : undefined;
    if (replicas !== undefined) out.push(fact("unit_instances", [file.path, svc, replicas], lineOf((node?.get("deploy", true) as YNode | undefined)) ?? at("scale")));

    const env = body.environment;
    const envNode = node?.get("environment", true);
    if (Array.isArray(env)) for (const e of env) out.push(fact("unit_env_name", [file.path, svc, String(e).split("=")[0]!], lineOf(envNode) ?? keyLine));
    else if (env && typeof env === "object") for (const k of Object.keys(env)) out.push(fact("unit_env_name", [file.path, svc, k], lineOf(envNode) ?? keyLine));
  }
  return out;
};
export default script;
