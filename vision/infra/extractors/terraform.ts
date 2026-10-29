import type { ComponentKind, ExtractedFacts } from "../types.js";
import { emptyFacts } from "../types.js";
import { envsOf, src } from "../common.js";

/** Rôle d'une ressource Terraform d'après son type — table factuelle, extensible. */
const KIND_BY_TYPE: [RegExp, ComponentKind][] = [
  [/cloudfront|cdn|fastly|cloudflare_(zone_settings|page_rule|ruleset)/, "cdn"],
  [/route53|dns_record|cloudflare_record|dns_zone/, "dns"],
  [/_lb$|_alb$|_elb$|load_balancer|api_gateway|apigateway|_gateway|ingress/, "gateway"],
  [/rds|db_instance|database|sql_database|postgres|mysql|dynamodb|cosmosdb|documentdb|aurora/, "database"],
  [/elasticache|redis|memorystore|memcache/, "cache"],
  [/sqs|sns|pubsub|kafka|mq_broker|servicebus|eventbridge/, "queue"],
  [/s3_bucket|storage_bucket|blob|_disk$|_volume$|efs|filestore/, "storage"],
  [/instance$|droplet|_vm$|virtual_machine|linode|server$|_host$/, "host"],
  [/ecs_service|cloud_run|app_service|lambda|cloudfunctions|container_app|kubernetes_deployment|k8s|app_engine|ec2_launch/, "service"],
  [/vpc|subnet|security_group|firewall|network/, "network"],
];

export function kindFromResourceType(type: string): ComponentKind {
  for (const [re, kind] of KIND_BY_TYPE) if (re.test(type)) return kind;
  return "other";
}

interface Block {
  keyword: string;
  labels: string[];
  body: string;
  line: number;
}

/** Fin (exclusive) du bloc dont l'accolade ouvrante précède `start` ; chaînes et commentaires ignorés. */
function blockEnd(content: string, start: number): number {
  let depth = 1;
  let i = start;
  let quote: string | null = null;
  while (i < content.length && depth > 0) {
    const ch = content[i]!;
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"') quote = ch;
    else if (ch === "#" || (ch === "/" && content[i + 1] === "/")) {
      while (i < content.length && content[i] !== "\n") i++;
    } else if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }
  return i;
}

/** Découpe les blocs de premier niveau d'un fichier HCL (accolades équilibrées). */
export function parseHclBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  let parsedUntil = 0;
  for (const m of content.matchAll(/^\s*(resource|module|provider|variable|output|data|terraform|locals)\b([^{\n]*)\{/gm)) {
    if (m.index < parsedUntil) continue;
    const start = m.index + m[0].length;
    const end = blockEnd(content, start);
    parsedUntil = end;
    const labels = [...m[2]!.matchAll(/"([^"]*)"/g)].map((x) => x[1]!);
    blocks.push({ keyword: m[1]!, labels, body: content.slice(start, end - 1), line: content.slice(0, m.index).split("\n").length });
  }
  return blocks;
}

/** Valeur littérale d'un attribut (chaîne, nombre, booléen) — une référence `x.y` n'est pas une valeur. */
function attr(body: string, name: string): string | undefined {
  const m = body.match(new RegExp(`^\\s*${name}\\s*=\\s*(?:"([^"]*)"|(true|false|-?\\d+(?:\\.\\d+)?))\\s*$`, "m"));
  return m ? (m[1] ?? m[2])!.trim() : undefined;
}

/**
 * Terraform : chaque `resource` devient un composant (rôle déduit du type),
 * chaque référence `type.name` dans le corps d'une autre ressource devient un
 * lien `connects_to`. Les `provider` deviennent des plateformes qui déploient
 * les ressources. Aucune valeur de `terraform.tfvars` n'est lue.
 */
export function extractTerraform(path: string, content: string, environment: string | undefined): ExtractedFacts {
  const facts = emptyFacts();
  const envs = envsOf(environment);
  const blocks = parseHclBlocks(content);
  const resourceIds = new Map<string, string>();

  for (const b of blocks) {
    if (b.keyword === "resource" && b.labels.length === 2) {
      const [type, name] = b.labels as [string, string];
      const kind = kindFromResourceType(type);
      const id = `tf:${type}.${name}`;
      resourceIds.set(`${type}.${name}`, id);
      const attrs: Record<string, string> = { type };
      for (const a of ["ami", "instance_type", "engine", "engine_version", "instance_class", "region", "bucket", "domain_name", "name", "size", "image", "runtime", "zone", "cidr_block", "load_balancer_type"]) {
        const v = attr(b.body, a);
        if (v && !v.startsWith("var.") && !v.startsWith("local.")) attrs[a] = v;
      }
      const count = attr(b.body, "count");
      if (count) attrs.count = count;
      facts.components.push({ id, name: `${type}.${name}`, kind, source: src(path, b.line), environments: envs, attrs });
    }
    if (b.keyword === "module" && b.labels[0]) {
      const id = `tf:module.${b.labels[0]}`;
      resourceIds.set(`module.${b.labels[0]}`, id);
      const attrs: Record<string, string> = {};
      const source = attr(b.body, "source");
      if (source) attrs.source = source;
      facts.components.push({ id, name: `module.${b.labels[0]}`, kind: "other", source: src(path, b.line), environments: envs, attrs });
    }
  }

  for (const b of blocks) {
    if (b.keyword !== "resource" && b.keyword !== "module") continue;
    const fromKey = b.keyword === "resource" ? `${b.labels[0]}.${b.labels[1]}` : `module.${b.labels[0]}`;
    const from = resourceIds.get(fromKey);
    if (!from) continue;
    const seen = new Set<string>();
    for (const m of b.body.matchAll(/\b((?:[a-z][a-z0-9_]*_[a-z0-9_]+|module)\.[a-zA-Z_][a-zA-Z0-9_-]*)\b/g)) {
      const to = resourceIds.get(m[1]!);
      if (!to || to === from || seen.has(to)) continue;
      seen.add(to);
      facts.links.push({ from, to, kind: "connects_to", source: src(path, b.line), environments: envs });
    }
    for (const v of b.body.matchAll(/\bvar\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
      const name = v[1]!.toUpperCase();
      if (!facts.envVars.some((e) => e.name === name && e.component === from)) facts.envVars.push({ name, component: from, source: src(path, b.line), environments: envs });
    }
  }

  for (const b of blocks) {
    if (b.keyword === "provider" && b.labels[0]) {
      const id = `tf:provider.${b.labels[0]}`;
      const attrs: Record<string, string> = {};
      const region = attr(b.body, "region");
      if (region && !region.startsWith("var.")) attrs.region = region;
      facts.components.push({ id, name: `provider ${b.labels[0]}`, kind: "platform", source: src(path, b.line), environments: envs, attrs });
      for (const c of facts.components) {
        if (c.id.startsWith("tf:") && c.id !== id && c.kind !== "platform" && !c.id.startsWith("tf:module.")) {
          facts.links.push({ from: id, to: c.id, kind: "deploys", source: src(path, b.line), environments: envs });
        }
      }
    }
  }
  return facts;
}
