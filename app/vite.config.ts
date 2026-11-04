import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API = `http://127.0.0.1:${process.env.VISION_UI_PORT ?? 4173}`;

export default defineConfig({
  root: import.meta.dirname,
  // La démonstration en ligne vit sous un sous-chemin : les adresses restent relatives.
  base: process.env.VITE_SNAPSHOT === "1" ? "./" : "/",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5173, proxy: { "/api": { target: API } } },
});
