import type { InfraComponent, InfraSourceFile } from "../infra/types.js";
import { CATALOG, catalogEntry, techsForImage, type CatalogEntry } from "./catalog.js";

/** Technologie qui décrit un format de fichier d'infrastructure (fait : le fichier source). */
export const INFRA_FORMAT_TECH: Partial<Record<InfraSourceFile["format"], string>> = {
  firebase: "firebase",
  cloudbuild: "googlecloud",
  "github-actions": "github-actions",
  dockerfile: "docker",
  "docker-compose": "docker",
  nginx: "nginx",
  caddy: "caddy",
  traefik: "traefik",
  terraform: "terraform",
  kubernetes: "kubernetes",
  vercel: "vercel",
  netlify: "netlify",
};

const DEPLOY_TOOL_TECH: [RegExp, string][] = [
  [/\bfirebase\s+deploy\b/, "firebase"],
  [/\bgcloud\b/, "googlecloud"],
  [/\bvercel\b/, "vercel"],
  [/\bnetlify\b/, "netlify"],
  [/\bkubectl\b/, "kubernetes"],
  [/\bterraform\b/, "terraform"],
  [/\bwrangler\b/, "cloudflare"],
];

/**
 * Technologie à afficher pour un composant d'infrastructure : d'abord son
 * image (une base `postgres:16` est PostgreSQL, pas « Docker »), puis la
 * commande d'un script de déploiement, puis le format du fichier qui le
 * décrit, enfin (composant déclaré) son nom s'il figure au catalogue.
 */
export function techForInfraComponent(c: InfraComponent, format: InfraSourceFile["format"] | undefined): CatalogEntry | undefined {
  if (c.attrs.plateforme === "Cloud Run") return catalogEntry("googlecloud");
  const image = c.attrs.image ?? c.attrs.base?.split(" → ").pop();
  if (image) {
    const hit = techsForImage(image).find((e) => e.id !== "nodejs" || c.kind === "image");
    if (hit && c.kind !== "image") return hit;
  }
  if (format === "package-scripts" && c.attrs.commande) {
    const hit = DEPLOY_TOOL_TECH.find(([re]) => re.test(c.attrs.commande!));
    if (hit) return catalogEntry(hit[1]);
  }
  const byFormat = format ? INFRA_FORMAT_TECH[format] : undefined;
  if (byFormat) return catalogEntry(byFormat);
  const name = c.name.toLowerCase();
  return CATALOG.find((e) => e.name.toLowerCase() === name || e.id === name);
}
