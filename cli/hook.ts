#!/usr/bin/env node
import { appendEvent } from "../vision/activity/journal.js";
import { eventFromHook } from "../vision/activity/hook.js";

/**
 * `vision hook <claude|codex>` — à brancher comme hook « command » de l'agent
 * (ADR 0013). Lit l'entrée JSON du hook sur stdin et ajoute un événement au
 * journal `.vision/activity/`. Ne bloque JAMAIS l'agent : sort toujours en 0,
 * sans rien écrire sur stdout, même si l'entrée est illisible.
 */
const agent = process.argv.slice(2).find((a) => a === "claude" || a === "codex");

let input = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  try {
    if (!agent) return;
    const outcome = eventFromHook(agent, JSON.parse(input));
    if (outcome) appendEvent(outcome.root, outcome.event);
  } catch {
    // Un journal incomplet vaut mieux qu'un agent bloqué.
  } finally {
    process.exit(0);
  }
});
