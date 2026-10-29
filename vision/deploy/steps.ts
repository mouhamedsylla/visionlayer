import type { StepKind } from "./types.js";

/**
 * Ce que fait une étape, reconnu à la forme de sa commande ou au nom de son
 * action, jamais au nom du projet. L'ordre compte : la première règle qui
 * reconnaît l'étape la range. `target` : la technologie visée par un
 * déploiement ou une image.
 */
const RULES: { kind: StepKind; target?: string; re: RegExp }[] = [
  { kind: "checkout", re: /^actions\/checkout@/ },
  { kind: "deploy", target: "flyio", re: /\bfly(ctl)? deploy\b|superfly\/flyctl-actions/ },
  { kind: "deploy", target: "vercel", re: /\bvercel\b.*(--prod|deploy)|amondnet\/vercel-action|vercel deploy/ },
  { kind: "deploy", target: "netlify", re: /\bnetlify deploy\b|nwtgck\/actions-netlify/ },
  { kind: "deploy", target: "firebase", re: /\bfirebase deploy\b|FirebaseExtended\/action-hosting-deploy/ },
  { kind: "deploy", target: "googlecloud", re: /\bgcloud (run|app|functions) deploy\b|google-github-actions\/deploy-/ },
  { kind: "deploy", target: "kubernetes", re: /\bkubectl (apply|rollout|set image)\b|\bhelm (upgrade|install)\b/ },
  { kind: "deploy", target: "railway", re: /\brailway up\b/ },
  { kind: "deploy", target: "render", re: /render\.com\/deploy|api\.render\.com.*deploys/ },
  { kind: "deploy", target: "amazonwebservices", re: /\baws (ecs update-service|s3 sync|lambda update-function-code)\b|\bsam deploy\b|\bcdk deploy\b|\bserverless deploy\b/ },
  { kind: "deploy", target: "heroku", re: /akhileshns\/heroku-deploy|git push heroku\b/ },
  { kind: "image", target: "docker", re: /\bdocker (build|push|buildx)\b|docker\/build-push-action|docker\/login-action/ },
  { kind: "setup", re: /^[\w-]+\/setup-[\w-]+@|^pnpm\/action-setup@|^actions\/cache@/ },
  { kind: "install", re: /\b(pnpm|npm|yarn|bun) (install|ci|i)\b|\bpip install\b|\bpoetry install\b|\bgo mod download\b|\bbundle install\b|\bcomposer install\b/ },
  { kind: "check", re: /\b(test|tests|typecheck|lint|check|vitest|jest|pytest|eslint|tsc|go vet|cargo test)\b/ },
  { kind: "build", re: /\bbuild\b|\bcompile\b/ },
];

export function classifyStep(command: string): { kind: StepKind; target?: string } {
  const rule = RULES.find((r) => r.re.test(command));
  return rule ? { kind: rule.kind, ...(rule.target ? { target: rule.target } : {}) } : { kind: "other" };
}
