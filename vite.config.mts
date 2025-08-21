import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Use workspace projects to control test execution order
		projects: [
			{
				// Run all tests except statsService.integration.test.ts in parallel first
				test: {
					name: "unit-tests",
					include: ["**/*.test.ts", "**/*.test.tsx"],
					exclude: ["**/node_modules/**", "**/dist/**", "tests/**", "**/statsService.integration.test.ts"],
					globals: true,
					restoreMocks: true,
					groupOrder: 1, // Runs first, tests run in parallel
				},
				plugins: [tsconfigPaths()],
			},
			{
				// Run statsService.integration.test.ts after all other tests complete
				test: {
					name: "integration-test",
					include: ["**/statsService.integration.test.ts"],
					exclude: ["**/node_modules/**", "**/dist/**", "tests/**"],
					globals: true,
					restoreMocks: true,
					groupOrder: 2, // Runs after group 1 completes
					fileParallelism: false, // Run without parallelism
				},
				plugins: [tsconfigPaths()],
			},
		],
		coverage: {
			exclude: ["**/node_modules/**", "**/index.ts, ", "vite.config.mts"],
		},
	},
	plugins: [tsconfigPaths()],
});
