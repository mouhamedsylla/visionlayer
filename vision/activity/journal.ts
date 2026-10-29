import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Journal d'activité des agents (ADR 0013) : ce qu'une session d'agent a
 * touché dans le repository, reçu par les hooks de Claude Code ou de Codex.
 *
 * Il ne contient JAMAIS le texte d'un prompt, d'une commande shell ni d'un
 * fichier : seulement l'événement, le nom de l'outil, les chemins de fichiers
 * du repository, le chemin du transcript local et des compteurs de tokens.
 * Il vit dans `.vision/activity/`, qui s'ignore lui-même dans git : c'est
 * l'activité d'une machine, pas un fait du système.
 */

export type AgentKind = "claude" | "codex";

export interface TokenUsage {
  /** Tokens d'entrée facturés plein tarif (hors cache). */
  input: number;
  /** Lus depuis le cache de prompt. */
  cacheRead: number;
  /** Écrits dans le cache de prompt (Claude). */
  cacheWrite: number;
  output: number;
  /** Tokens de raisonnement, quand l'agent les distingue (inclus dans output chez Claude). */
  reasoning: number;
  /** Modèle principal de la session (le plus utilisé). */
  model?: string;
  /** Tokens par modèle, pour chiffrer une session qui a changé de modèle. */
  byModel: Record<string, Omit<TokenUsage, "model" | "byModel">>;
}

export interface ActivityEvent {
  at: string;
  agent: AgentKind;
  session: string;
  /** Nom d'événement du hook : SessionStart, PostToolUse, Stop, SessionEnd… */
  event: string;
  /** Nom de l'outil appelé (Edit, apply_patch, mcp__visionlayer__vision_flow…), jamais ses arguments. */
  tool?: string;
  /** Fichiers du repository modifiés par cet appel, relatifs à la racine. */
  files?: string[];
  /** Chemin local du transcript de la session (lu pour compter les tokens, jamais copié). */
  transcript?: string;
  model?: string;
  /** Compteurs de la session au moment de l'événement (Stop, SessionEnd). */
  usage?: TokenUsage;
}

export const ACTIVITY_DIR = join(".vision", "activity");
const JOURNAL = "journal.jsonl";

export function appendEvent(root: string, event: ActivityEvent): void {
  const dir = join(root, ACTIVITY_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    // L'activité d'une machine n'a rien à faire dans l'historique du projet.
    writeFileSync(join(dir, ".gitignore"), "*\n");
  }
  appendFileSync(join(dir, JOURNAL), JSON.stringify(event) + "\n");
}

export function readJournal(root: string): ActivityEvent[] {
  const path = join(root, ACTIVITY_DIR, JOURNAL);
  if (!existsSync(path)) return [];
  const out: ActivityEvent[] = [];
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as ActivityEvent);
    } catch {
      // Une ligne tronquée (écriture interrompue) ne doit pas rendre le journal illisible.
    }
  }
  return out;
}
