import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./shell/App";
import "./theme/tokens.css";
import "./theme/base.css";
import "./theme/ds.css";
import "./theme/boards.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
