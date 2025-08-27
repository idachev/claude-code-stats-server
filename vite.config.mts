import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["**/node_modules/**", "**/index.ts, ", "vite.config.mts"],
    },
    globals: true,
    restoreMocks: true,
    exclude: ["**/node_modules/**", "**/dist/**", "tests/**"],
    // Disable file parallelism to run tests sequentially
    fileParallelism: false,
  },
  plugins: [tsconfigPaths()],
});
