import { parseAllDocuments } from "yaml";
import type { ComponentKind, ExtractedFacts, InfraComponent } from "../types.js";
import { emptyFacts } from "../types.js";
import { componentId, envsOf, isEnvVarName, kindFromImage, src } from "../common.js";

type Rec = Record<string, unknown>;
const asRec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown): string | undefined => (typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined);

/**
 * Manifestes Kubernetes (multi-documents) : Deployment/StatefulSet/DaemonSet/
 * CronJob → composants (rôle d'après l'image) ; Service → attribut du
 * composant qu'il sélectionne ; Ingress → composant `gateway` + routes ;
 * ConfigMap/Secret → NOMS de clés seulement.
 */
export function extractKubernetes(path: string, content: string, environment: string | undefined): ExtractedFacts {
  const facts = emptyFacts();
  const envs = envsOf(environment);
  const docs = parseAllDocuments(content);
  const bySelector: { labels: Record<string, string>; component: InfraComponent }[] = [];
  const serviceToWorkload = new Map<string, string>();
  const pending: (() => void)[] = [];

  for (const d of docs) {
    const doc = asRec(d.toJS());
    const kind = asStr(doc.kind);
    const meta = asRec(doc.metadata);
    const name = asStr(meta.name);
    if (!kind || !name) continue;
    const line = (d.range?.[0] !== undefined ? content.slice(0, d.range[0]).split("\n").length : 1);
    const spec = asRec(doc.spec);
    const namespace = asStr(meta.namespace);

    if (["Deployment", "StatefulSet", "DaemonSet", "Job", "CronJob"].includes(kind)) {
      const podSpec = kind === "CronJob" ? asRec(asRec(asRec(asRec(spec.jobTemplate).spec).template).spec) : asRec(asRec(spec.template).spec);
      const containers = asList(podSpec.containers).map(asRec);
      const image = asStr(containers[0]?.image);
      const role: ComponentKind = kind === "CronJob" || kind === "Job" ? "job" : kindFromImage(image, name);
      const id = componentId(role, name);
      const attrs: Record<string, string> = { kind };
      if (image) attrs.image = image;
      const replicas = asStr(spec.replicas);
      if (replicas) attrs.replicas = replicas;
      if (namespace) attrs.namespace = namespace;
      const ports = containers.flatMap((c) => asList(c.ports).map((p) => asStr(asRec(p).containerPort) ?? "?"));
      if (ports.length) attrs.ports = ports.join(", ");
      const schedule = asStr(spec.schedule);
      if (schedule) attrs.schedule = schedule;
      const component: InfraComponent = { id, name, kind: role, source: src(path, line), environments: envs, attrs };
      facts.components.push(component);
      const labels = Object.fromEntries(Object.entries(asRec(asRec(asRec(spec.template).metadata).labels)).map(([k, v]) => [k, String(v)]));
      bySelector.push({ labels, component });
      for (const c of containers) {
        for (const e of asList(c.env).map(asRec)) {
          const n = asStr(e.name);
          if (n && isEnvVarName(n)) facts.envVars.push({ name: n, component: id, source: src(path, line), environments: envs });
        }
        for (const ef of asList(c.envFrom).map(asRec)) {
          const ref = asStr(asRec(ef.configMapRef).name) ?? asStr(asRec(ef.secretRef).name);
          if (ref) attrs.envFrom = [attrs.envFrom, ref].filter(Boolean).join(", ");
        }
      }
      continue;
    }

    if (kind === "Service") {
      const selector = Object.fromEntries(Object.entries(asRec(spec.selector)).map(([k, v]) => [k, String(v)]));
      const ports = asList(spec.ports).map((p) => `${asStr(asRec(p).port) ?? "?"}→${asStr(asRec(p).targetPort) ?? asStr(asRec(p).port) ?? "?"}`);
      pending.push(() => {
        const target = bySelector.find((w) => Object.entries(selector).every(([k, v]) => w.labels[k] === v));
        if (!target) return;
        serviceToWorkload.set(name, target.component.id);
        target.component.attrs.service = `${name}${ports.length ? ` (${ports.join(", ")})` : ""}`;
        const type = asStr(spec.type);
        if (type && type !== "ClusterIP") target.component.attrs.exposure = type;
      });
      continue;
    }

    if (kind === "Ingress") {
      const id = componentId("gateway", name);
      const hosts: string[] = [];
      const routes: { host: string; p: string; svc: string }[] = [];
      for (const rule of asList(spec.rules).map(asRec)) {
        const host = asStr(rule.host) ?? "*";
        hosts.push(host);
        for (const p of asList(asRec(rule.http).paths).map(asRec)) {
          const svc = asStr(asRec(asRec(asRec(p.backend).service)).name) ?? asStr(asRec(p.backend).serviceName);
          if (svc) routes.push({ host, p: asStr(p.path) ?? "/", svc });
        }
      }
      const attrs: Record<string, string> = { kind, domains: hosts.join(", ") };
      const cls = asStr(spec.ingressClassName) ?? asStr(asRec(meta.annotations)["kubernetes.io/ingress.class"]);
      if (cls) attrs.class = cls;
      attrs.tls = asList(spec.tls).length ? "oui" : "non";
      facts.components.push({ id, name, kind: "gateway", source: src(path, line), environments: envs, attrs });
      pending.push(() => {
        for (const r of routes) {
          const to = serviceToWorkload.get(r.svc) ?? `name:${r.svc}`;
          facts.links.push({ from: id, to, kind: "routes_to", source: src(path, line), environments: envs, label: `${r.host}${r.p}` });
        }
      });
      continue;
    }

    if (kind === "ConfigMap" || kind === "Secret") {
      for (const k of Object.keys({ ...asRec(doc.data), ...asRec(doc.stringData) })) {
        if (isEnvVarName(k)) facts.envVars.push({ name: k, source: src(path, line), environments: envs });
      }
      continue;
    }

    if (kind === "Namespace" || kind === "HorizontalPodAutoscaler" || kind === "PersistentVolumeClaim") {
      const role: ComponentKind = kind === "PersistentVolumeClaim" ? "storage" : "other";
      if (kind === "Namespace") continue;
      const attrs: Record<string, string> = { kind };
      const storage = asStr(asRec(asRec(spec.resources).requests).storage);
      if (storage) attrs.size = storage;
      facts.components.push({ id: componentId(role, name), name, kind: role, source: src(path, line), environments: envs, attrs });
    }
  }
  for (const fn of pending) fn();
  return facts;
}
