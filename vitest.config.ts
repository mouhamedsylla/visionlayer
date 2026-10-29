import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Tests de l'interface (jsdom) ; les autres tests restent sur node:test (`tests/**/*.test.ts`).
export default defineConfig({
  plugins: [react()],
  test: {
    include: ["ui/tests/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["ui/tests/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
