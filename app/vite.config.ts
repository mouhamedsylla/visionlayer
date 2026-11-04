import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API = `http://127.0.0.1:${process.env.VISION_UI_PORT ?? 4173}`;

export default defineConfig({
  root: import.meta.dirname,
  // Chaque projet vit sous un sous-chemin (`/p/<id>/`) : les adresses restent relatives.
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5173, proxy: { "/api": { target: API } } },
});
