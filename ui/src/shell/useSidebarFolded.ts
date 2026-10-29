import { useStoredFlag } from "../components/useStoredFlag";

/** Barre latérale ouverte ou réduite. */
export const useSidebarFolded = () => useStoredFlag("vision.sidebar.folded");
