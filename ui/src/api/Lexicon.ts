import { createContext, useContext } from "react";
import type { Lexicon as Names } from "../domain/text/techMarks";

/** Les noms du modèle ouvert (blocs, tables, files, variables), fournis une fois pour que chaque phrase les reconnaisse. */
export const Lexicon = createContext<Names>(new Map());

export const useLexicon = () => useContext(Lexicon);
