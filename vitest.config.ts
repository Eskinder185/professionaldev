import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// NOTE: run through `npm test` / `npm run test:watch`. Those scripts pass `--root .`, which works around a
// Vitest 5 / Windows bug: when the shell's working directory has a lowercase drive letter (c:\...), Vitest
// loads two copies of itself and every file fails with "Vitest failed to find the runner".
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
});
