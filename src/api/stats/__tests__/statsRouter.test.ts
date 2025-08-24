import type { Server } from "node:http";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, modelUsage, usageStats, users } from "@/db/index";
import { app } from "@/server";
import { cleanupTestDatabase } from "@/test-utils/cleanupTestDatabase";

describe("Stats API Endpoint Filter Tests", () => {
	let server: Server;
	let testUserId: number;

	beforeAll(async () => {
		// Start server
		server = app.listen(0);

		// Create test user and data
		const [user] = await db.insert(users).values({ username: "test-api-filter-user" }).returning();
		testUserId = user.id;

		// Create test data for different dates
		const testDates = [
			"2024-01-15", // January 2024
			"2024-02-20", // February 2024
			"2024-03-10", // March 2024
			"2024-11-15", // November 2024
			"2024-12-20", // December 2024
		];

		for (const date of testDates) {
			const [stat] = await db
				.insert(usageStats)
				.values({
					userId: testUserId,
					date: date,
					inputTokens: 100000,
					outputTokens: 50000,
					cacheCreationInputTokens: 20000,
					cacheReadInputTokens: 10000,
					totalTokens: 180000,
					totalCost: "18.5",
				})
				.returning();

			// Add model usage
			await db.insert(modelUsage).values([
				{
					usageStatsId: stat.id,
					model: "claude-3-5-sonnet",
					provider: "anthropic",
					inputTokens: 60000,
					outputTokens: 30000,
					cacheCreationInputTokens: 10000,
					cacheReadInputTokens: 5000,
					cost: "10.0",
				},
				{
					usageStatsId: stat.id,
					model: "claude-3-opus",
					provider: "anthropic",
					inputTokens: 40000,
					outputTokens: 20000,
					cacheCreationInputTokens: 10000,
					cacheReadInputTokens: 5000,
					cost: "8.5",
				},
			]);
		}
	});

	afterAll(async () => {
		await cleanupTestDatabase();

		// Close server
		server.close();
	});

	describe("Dashboard-compatible filters", () => {
		it("should accept period=all filter", async () => {
			const response = await request(server).get("/claude-code-stats").query({ period: "all" });

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("period", "all");
			expect(response.body).toHaveProperty("stats");
			expect(Array.isArray(response.body.stats)).toBe(true);
		});

		it("should accept period=week filter", async () => {
			const response = await request(server).get("/claude-code-stats").query({ period: "week" });

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("period", "custom");
			expect(response.body).toHaveProperty("stats");
		});

		it("should accept period=month filter", async () => {
			const response = await request(server).get("/claude-code-stats").query({ period: "month" });

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("period", "custom");
			expect(response.body).toHaveProperty("stats");
		});

		it("should accept year parameter", async () => {
			const response = await request(server).get("/claude-code-stats").query({
				period: "month",
				year: 2024,
			});

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("stats");
		});

		it("should accept month parameter", async () => {
			const response = await request(server).get("/claude-code-stats").query({
				period: "month",
				year: 2024,
				month: "january",
			});

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("stats");
			// Should have data for January 2024
			const januaryStats = response.body.stats.filter((s: any) => s.date.startsWith("2024-01"));
			expect(januaryStats.length).toBeGreaterThan(0);
		});

		it("should accept week parameter", async () => {
			const response = await request(server).get("/claude-code-stats").query({
				period: "week",
				year: 2024,
				week: 3,
			});

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("stats");
		});

		it("should accept user filter", async () => {
			const response = await request(server).get("/claude-code-stats").query({
				period: "all",
				user: "test-api-filter-user",
			});

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("stats");
			// All stats should be for the test user
			response.body.stats.forEach((stat: any) => {
				expect(stat.username).toBe("test-api-filter-user");
			});
		});

		it("should accept model filter", async () => {
			const response = await request(server).get("/claude-code-stats").query({
				period: "all",
				model: "anthropic/claude-3-opus",
			});

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("stats");
			// All stats should have the filtered model
			response.body.stats.forEach((stat: any) => {
				if (stat.models && stat.models.length > 0) {
					stat.models.forEach((model: any) => {
						expect(model.provider).toBe("anthropic");
						expect(model.name).toBe("claude-3-opus");
					});
				}
			});
		});

		it("should accept multiple filters combined", async () => {
			const response = await request(server).get("/claude-code-stats").query({
				period: "month",
				year: 2024,
				month: "february",
				user: "test-api-filter-user",
				model: "anthropic/claude-3-5-sonnet",
			});

			expect(response.status).toBe(200);
			expect(response.body).toHaveProperty("stats");

			// Should have February 2024 data for the test user with the specific model
			response.body.stats.forEach((stat: any) => {
				expect(stat.date.startsWith("2024-02")).toBe(true);
				expect(stat.username).toBe("test-api-filter-user");
				if (stat.models && stat.models.length > 0) {
					stat.models.forEach((model: any) => {
						expect(model.provider).toBe("anthropic");
						expect(model.name).toBe("claude-3-5-sonnet");
					});
				}
			});
		});

		it("should handle invalid month names gracefully", async () => {
			const response = await request(server).get("/claude-code-stats").query({
				period: "month",
				month: "invalid-month",
			});

			// Should fail validation
			expect(response.status).toBe(400);
		});

		it("should validate all month names", async () => {
			const validMonths = [
				"january",
				"february",
				"march",
				"april",
				"may",
				"june",
				"july",
				"august",
				"september",
				"october",
				"november",
				"december",
			];

			for (const month of validMonths) {
				const response = await request(server).get("/claude-code-stats").query({
					period: "month",
					year: 2024,
					month: month,
				});

				expect(response.status).toBe(200);
			}
		});

		it("should handle week numbers correctly", async () => {
			// Test week 1 and week 53
			const weekTests = [1, 25, 53];

			for (const week of weekTests) {
				const response = await request(server).get("/claude-code-stats").query({
					period: "week",
					year: 2024,
					week: week,
				});

				expect(response.status).toBe(200);
				expect(response.body).toHaveProperty("stats");
			}
		});

		it("should reject invalid week numbers", async () => {
			const invalidWeeks = [0, 54, -1, 100];

			for (const week of invalidWeeks) {
				const response = await request(server).get("/claude-code-stats").query({
					period: "week",
					week: week,
				});

				expect(response.status).toBe(400);
			}
		});
	});

	describe("Filter behavior consistency with dashboard", () => {
		it("should return same data structure as dashboard expects", async () => {
			const response = await request(server).get("/claude-code-stats").query({ period: "all" });

			expect(response.status).toBe(200);

			// Check required fields that dashboard uses
			expect(response.body).toHaveProperty("period");
			expect(response.body).toHaveProperty("startDate");
			expect(response.body).toHaveProperty("endDate");
			expect(response.body).toHaveProperty("stats");
			expect(response.body).toHaveProperty("summary");

			// Check summary structure
			expect(response.body.summary).toHaveProperty("totalCost");
			expect(response.body.summary).toHaveProperty("totalTokens");
			expect(response.body.summary).toHaveProperty("uniqueUsers");
			expect(response.body.summary).toHaveProperty("totalDays");

			// Check stats structure
			if (response.body.stats.length > 0) {
				const stat = response.body.stats[0];
				expect(stat).toHaveProperty("date");
				expect(stat).toHaveProperty("username");
				expect(stat).toHaveProperty("totalCost");
				expect(stat).toHaveProperty("totalTokens");
				expect(stat).toHaveProperty("models");
			}
		});

		it("should filter by model and recalculate totals", async () => {
			// First get all models
			const allResponse = await request(server).get("/claude-code-stats").query({
				period: "all",
				user: "test-api-filter-user",
			});

			// Then get filtered by specific model
			const filteredResponse = await request(server).get("/claude-code-stats").query({
				period: "all",
				user: "test-api-filter-user",
				model: "anthropic/claude-3-opus",
			});

			expect(allResponse.status).toBe(200);
			expect(filteredResponse.status).toBe(200);

			// Filtered should have less or equal total cost
			if (allResponse.body.summary && filteredResponse.body.summary) {
				expect(filteredResponse.body.summary.totalCost).toBeLessThanOrEqual(allResponse.body.summary.totalCost);
			}
		});
	});
});
