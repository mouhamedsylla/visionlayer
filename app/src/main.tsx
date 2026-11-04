import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./shell/App";
import { Projects } from "./shell/Projects";
import "./theme/tokens.css";
import "./theme/base.css";
import "./theme/ds.css";
import "./theme/boards.css";
import "./lang/lang.css";

/** Sous `/p/<id>/`, un projet ; à la racine, l'entrée du produit quand elle existe, sinon le projet servi seul. */
const root = createRoot(document.getElementById("root")!);
const inProject = window.location.pathname.startsWith("/p/");
const start = async () => {
  const hub = inProject ? undefined : await fetch("/hub/projects").then((r) => (r.ok ? r.json() : undefined)).catch(() => undefined);
  root.render(<StrictMode>{hub ? <Projects hub={hub} /> : <App />}</StrictMode>);
};
void start();
