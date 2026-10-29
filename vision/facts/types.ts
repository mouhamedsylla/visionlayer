import type { Proof } from "../arch/types.js";
import type { Language } from "../model/types.js";
import type { Value } from "./datalog.js";

/**
 * Base de faits (doc 07 §4.2, RYP-190). Un fait est atomique, neutre, et
 * rattaché au fichier qui le prouve : un fichier modifié ne recalcule que ses
 * faits.
 */

/** Un fichier tel qu'un lecteur le reçoit. */
export interface FileInput {
  path: string;
  /** Langage de code, absent pour un manifeste. */
  language?: Language;
  source: string;
}

/** Un fait établi par un fichier : `entrypoint("src/app.ts", "http", "GET /x", …)`. */
export interface FileFact {
  rel: string;
  args: Value[];
  proof: Proof;
}
