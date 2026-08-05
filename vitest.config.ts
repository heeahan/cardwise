import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "server-only": fileURLToPath(new URL("./tests/unit/server-only-stub.ts", import.meta.url)) } },
  test: { environment: "node", include: ["tests/unit/**/*.test.ts"], coverage: { reporter: ["text", "html"], include: ["lib/benefit-engine/**/*.ts"] } },
});
