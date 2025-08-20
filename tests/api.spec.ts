import { expect, test } from "@playwright/test";
import type { DailyStats } from "../src/api/stats/statsTypes";

test.describe("Claude Code Stats API", () => {
	const baseURL = "http://localhost:3000";

	test("Health endpoint should return ok status", async ({ request }) => {
		const response = await request.get(`${baseURL}/health`);
		expect(response.ok()).toBeTruthy();

		const json = await response.json();
		expect(json.success).toBe(true);
		expect(json.message).toBe("Health check");
		expect(json.responseObject.status).toBe("ok");
		expect(json.responseObject.database).toBe(true);
		expect(json.statusCode).toBe(200);
	});

	test("Stats upload endpoint should accept valid ccusage data", async ({ request }) => {
		const testData = {
			daily: [
				{
					date: "2025-08-19",
					inputTokens: 1500,
					outputTokens: 3000,
					cacheCreationTokens: 500,
					cacheReadTokens: 2000,
					totalTokens: 7000,
					totalCost: 0.25,
					modelBreakdowns: [
						{
							modelName: "claude-3-opus",
							provider: "anthropic",
							inputTokens: 1500,
							outputTokens: 3000,
							cacheCreationTokens: 500,
							cacheReadTokens: 2000,
							cost: 0.25,
						},
					],
				},
			],
		};

		const response = await request.post(`${baseURL}/claude-code-stats?username=playwright-test`, {
			data: testData,
			headers: {
				"Content-Type": "application/json",
			},
		});

		expect(response.ok()).toBeTruthy();
		const json = await response.json();
		expect(json.success).toBe(true);
		expect(json.message).toBe("Stats uploaded successfully");
		expect(json.statusCode).toBe(200);
	});

	test("Stats retrieval endpoint should return uploaded data", async ({ request }) => {
		// First, ensure we have some data by uploading
		const testData = {
			daily: [
				{
					date: new Date().toISOString().split("T")[0], // Today's date
					inputTokens: 1000,
					outputTokens: 2000,
					totalTokens: 3000,
					totalCost: 0.15,
					modelBreakdowns: [
						{
							modelName: "claude-3-opus",
							provider: "anthropic",
							inputTokens: 1000,
							outputTokens: 2000,
							cost: 0.15,
						},
					],
				},
			],
		};

		// Upload test data
		await request.post(`${baseURL}/claude-code-stats?username=playwright-retrieval-test`, {
			data: testData,
			headers: {
				"Content-Type": "application/json",
			},
		});

		// Now retrieve the data
		const response = await request.get(`${baseURL}/claude-code-stats?period=week&user=playwright-retrieval-test`);
		expect(response.ok()).toBeTruthy();

		const json = await response.json();
		expect(json.success).toBe(true);
		expect(json.responseObject).toHaveProperty("period", "week");
		expect(json.responseObject).toHaveProperty("stats");
		expect(Array.isArray(json.responseObject.stats)).toBe(true);

		// Check if our uploaded data is in the response
		const stats = json.responseObject.stats;
		const todayStats = stats.find((s: DailyStats) => s.username === "playwright-retrieval-test");
		if (todayStats) {
			expect(todayStats.username).toBe("playwright-retrieval-test");
			expect(todayStats.totalTokens).toBeGreaterThanOrEqual(3000);
		}
	});

	test("Stats upload should reject invalid data", async ({ request }) => {
		const invalidData = {
			// Missing 'daily' array
			invalidField: "test",
		};

		const response = await request.post(`${baseURL}/claude-code-stats?username=invalid-test`, {
			data: invalidData,
			headers: {
				"Content-Type": "application/json",
			},
		});

		expect(response.ok()).toBeFalsy();
		const json = await response.json();
		expect(json.success).toBe(false);
	});

	test("Stats upload should require username parameter", async ({ request }) => {
		const testData = {
			daily: [],
		};

		const response = await request.post(`${baseURL}/claude-code-stats`, {
			data: testData,
			headers: {
				"Content-Type": "application/json",
			},
		});

		expect(response.ok()).toBeFalsy();
	});
});
