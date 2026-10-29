import { createContext, useContext } from "react";

/** La version de la carte lue (`builtAt`) : un passage de code se relit quand elle change. */
export const SourceVersion = createContext("");

export const useSourceVersion = () => useContext(SourceVersion);
