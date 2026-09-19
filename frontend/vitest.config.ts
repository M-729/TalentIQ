import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

// Reuses the real app's plugins/alias config (react(), tailwindcss(), the
// "@" path alias) rather than duplicating it, and adds only what testing
// itself needs: a DOM environment and a small setup file. Kept as a
// separate file from vite.config.ts so the production build config stays
// untouched by test-only concerns.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
    },
  })
);
