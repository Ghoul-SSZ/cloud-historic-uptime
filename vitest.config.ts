import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scrapers/**/*.test.ts"],
  },
});
