import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    maxWorkers: 2,
    execArgv: ["--max-old-space-size=4096"],
    coverage: { provider: "v8", include: ["src/domain/**", "src/server/**"], reporter: ["text", "lcov"] },
  },
});
