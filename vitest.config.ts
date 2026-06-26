import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

// Minimal, isolated Vitest setup. Scope: pure provider logic only
// (classification, inclusion/exclusion, friendly detection, deduplication).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
