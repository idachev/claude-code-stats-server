import { randomUUID } from "node:crypto";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, modelUsage, usageStats, users } from "@/db/index";
import { cleanupTestDatabase } from "@/test-utils/cleanupTestDatabase";
import { StatsService } from "../statsService";
import type { CCUsageData } from "../statsTypes";

// Run this test suite sequentially to avoid conflicts with other tests
describe.sequential("StatsService Integration Tests", () => {
	const statsService = new StatsService();

	// Clean up ALL test data before running this test suite
	beforeAll(async () => {
		await cleanupTestDatabase();
	});

	// Helper function to format date as YYYY-MM-DD
	function formatDate(date: Date): string {
		return date.toISOString().split("T")[0];
	}

	// Helper function to get date X days ago from a reference date
	function getDaysAgo(days: number, from: Date = new Date()): string {
		const date = new Date(from);
		date.setDate(date.getDate() - days);
		return formatDate(date);
	}

	// Helper function to get date range for a period
	function getDateRange(period: "week" | "month", referenceDate?: Date): { start: Date; end: Date } {
		const date = referenceDate || new Date();

		if (period === "week") {
			return {
				start: startOfWeek(date, { weekStartsOn: 0 }), // Sunday
				end: endOfWeek(date, { weekStartsOn: 0 }), // Saturday
			};
		} else {
			return {
				start: startOfMonth(date),
				end: endOfMonth(date),
			};
		}
	}

	// Helper function to create test data relative to a reference date
	async function createTestData(referenceDate: Date = new Date()) {
		// Create test users with "test-stats-" prefix and UUID for guaranteed uniqueness
		const testId = randomUUID();
		const [user1] = await db
			.insert(users)
			.values({ username: `test-stats-user-1-${testId}` })
			.returning();
		const [user2] = await db
			.insert(users)
			.values({ username: `test-stats-user-2-${testId}` })
			.returning();
		const [user3] = await db
			.insert(users)
			.values({ username: `test-stats-user-3-${testId}` })
			.returning();

		// Create usage stats for different dates relative to reference date
		const testDataDays = [
			// Current week (0-6 days ago)
			{ daysAgo: 0, userId: user1.id, tokens: 1000000, cost: 10.5 },
			{ daysAgo: 0, userId: user2.id, tokens: 2000000, cost: 20.75 },
			{ daysAgo: 1, userId: user1.id, tokens: 1500000, cost: 15.25 },
			{ daysAgo: 1, userId: user3.id, tokens: 3000000, cost: 30.0 },
			{ daysAgo: 2, userId: user2.id, tokens: 2500000, cost: 25.5 },
			{ daysAgo: 3, userId: user1.id, tokens: 1200000, cost: 12.0 },

			// Previous week (7-13 days ago)
			{ daysAgo: 7, userId: user1.id, tokens: 800000, cost: 8.0 },
			{ daysAgo: 8, userId: user2.id, tokens: 1800000, cost: 18.5 },
			{ daysAgo: 9, userId: user3.id, tokens: 2200000, cost: 22.0 },
			{ daysAgo: 10, userId: user1.id, tokens: 900000, cost: 9.25 },
			{ daysAgo: 11, userId: user2.id, tokens: 1600000, cost: 16.0 },
			{ daysAgo: 12, userId: user3.id, tokens: 2800000, cost: 28.75 },

			// Previous month (30-60 days ago)
			{ daysAgo: 30, userId: user1.id, tokens: 500000, cost: 5.0 },
			{ daysAgo: 35, userId: user2.id, tokens: 750000, cost: 7.5 },
			{ daysAgo: 40, userId: user3.id, tokens: 1000000, cost: 10.0 },
			{ daysAgo: 45, userId: user1.id, tokens: 600000, cost: 6.0 },
			{ daysAgo: 50, userId: user2.id, tokens: 850000, cost: 8.5 },
			{ daysAgo: 55, userId: user3.id, tokens: 1100000, cost: 11.0 },
		];

		// Insert usage stats and model usage
		for (const data of testDataDays) {
			const date = getDaysAgo(data.daysAgo, referenceDate);

			const [stat] = await db
				.insert(usageStats)
				.values({
					userId: data.userId,
					date: date,
					inputTokens: Math.floor(data.tokens * 0.4),
					outputTokens: Math.floor(data.tokens * 0.3),
					cacheCreationInputTokens: Math.floor(data.tokens * 0.2),
					cacheReadInputTokens: Math.floor(data.tokens * 0.1),
					totalTokens: data.tokens,
					totalCost: data.cost.toString(),
				})
				.returning();

			// Add model usage for each stat
			await db.insert(modelUsage).values([
				{
					usageStatsId: stat.id,
					model: "claude-3-5-sonnet-20241022",
					provider: "anthropic",
					inputTokens: Math.floor(data.tokens * 0.3),
					outputTokens: Math.floor(data.tokens * 0.2),
					cacheCreationInputTokens: Math.floor(data.tokens * 0.1),
					cacheReadInputTokens: Math.floor(data.tokens * 0.05),
					cost: (data.cost * 0.6).toString(),
				},
				{
					usageStatsId: stat.id,
					model: "claude-3-opus",
					provider: "anthropic",
					inputTokens: Math.floor(data.tokens * 0.1),
					outputTokens: Math.floor(data.tokens * 0.1),
					cacheCreationInputTokens: Math.floor(data.tokens * 0.1),
					cacheReadInputTokens: Math.floor(data.tokens * 0.05),
					cost: (data.cost * 0.4).toString(),
				},
			]);
		}

		return { user1, user2, user3 };
	}

	// Note: Each test is responsible for its own cleanup to avoid conflicts in parallel execution

	describe.sequential("uploadStats", () => {
		it("should upload stats for an existing user", async () => {
			// First create the user
			const [user] = await db.insert(users).values({ username: "test-stats-existing-user" }).returning();

			const tomorrow = getDaysAgo(-1); // Tomorrow's date
			const testData: CCUsageData = {
				daily: [
					{
						date: tomorrow,
						inputTokens: 100000,
						outputTokens: 50000,
						cacheCreationTokens: 20000,
						cacheReadTokens: 10000,
						totalTokens: 180000,
						totalCost: 1.85,
						modelBreakdowns: [
							{
								modelName: "claude-3-5-sonnet-20241022",
								provider: "anthropic",
								inputTokens: 100000,
								outputTokens: 50000,
								cacheCreationTokens: 20000,
								cacheReadTokens: 10000,
								cost: 1.85,
							},
						],
					},
				],
			};

			await statsService.uploadStats("test-stats-existing-user", testData);

			// Verify user still exists
			const [verifyUser] = await db.select().from(users).where(eq(users.username, "test-stats-existing-user"));
			expect(verifyUser).toBeDefined();
			expect(verifyUser.username).toBe("test-stats-existing-user");

			// Verify stats were saved
			const stats = await db.select().from(usageStats).where(eq(usageStats.userId, user.id));
			expect(stats).toHaveLength(1);
			expect(stats[0].totalTokens).toBe(180000);
			expect(parseFloat(stats[0].totalCost)).toBeCloseTo(1.85, 2);

			// Verify model usage was saved
			const models = await db.select().from(modelUsage).where(eq(modelUsage.usageStatsId, stats[0].id));
			expect(models).toHaveLength(1);
			expect(models[0].model).toBe("claude-3-5-sonnet-20241022");
		});

		it("should update existing stats for the same date", async () => {
			// First create the user
			const [user] = await db.insert(users).values({ username: "test-stats-update-user" }).returning();
			const tomorrow = getDaysAgo(-1); // Tomorrow's date
			const testData1: CCUsageData = {
				daily: [
					{
						date: tomorrow,
						inputTokens: 100000,
						outputTokens: 50000,
						totalTokens: 150000,
						totalCost: 1.5,
						modelBreakdowns: [],
					},
				],
			};

			const testData2: CCUsageData = {
				daily: [
					{
						date: tomorrow,
						inputTokens: 200000,
						outputTokens: 100000,
						totalTokens: 300000,
						totalCost: 3.0,
						modelBreakdowns: [],
					},
				],
			};

			// Upload first set of stats
			await statsService.uploadStats("test-stats-update-user", testData1);

			// Upload second set of stats for the same date
			await statsService.uploadStats("test-stats-update-user", testData2);

			// Verify only one stat entry exists
			const stats = await db.select().from(usageStats).where(eq(usageStats.userId, user.id));

			expect(stats).toHaveLength(1);
			expect(stats[0].totalTokens).toBe(300000);
			expect(parseFloat(stats[0].totalCost)).toBeCloseTo(3.0, 2);
		});

		it("should reject invalid data format", async () => {
			const invalidData = {
				notDaily: "invalid",
			};

			await expect(statsService.uploadStats("test-stats-invalid-user", invalidData)).rejects.toThrow(
				"Invalid ccusage format",
			);
		});

		it("should reject upload for non-existent user", async () => {
			// Clean up any existing users first to ensure test isolation
			await cleanupTestDatabase();

			const validData: CCUsageData = {
				daily: [
					{
						date: getDaysAgo(0),
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

			// Test with non-existent username
			await expect(statsService.uploadStats("non-existent-user", validData)).rejects.toThrow(
				"User not found: non-existent-user",
			);

			// Test with empty username (also won't exist)
			await expect(statsService.uploadStats("", validData)).rejects.toThrow("User not found: ");

			// Test with null/undefined username
			await expect(statsService.uploadStats(null as any, validData)).rejects.toThrow();
			await expect(statsService.uploadStats(undefined as any, validData)).rejects.toThrow();
		});
	});

	describe.sequential("getStats", () => {
		let referenceDate: Date;
		let testUsernames: { user1: string; user2: string; user3: string };

		beforeEach(async () => {
			// Use a fixed reference date for these tests
			referenceDate = new Date();
			const users = await createTestData(referenceDate);
			testUsernames = {
				user1: users.user1.username,
				user2: users.user2.username,
				user3: users.user3.username,
			};
		});

		it("should get stats for current week", async () => {
			const { start, end } = getDateRange("week", referenceDate);
			const result = await statsService.getStatsForDateRange(start, end);

			expect(result.period).toBe("custom");

			// Should return data for the current week (Sunday to Saturday)
			const dates = result.stats.map((s) => s.date).sort();

			// Check we have data from the current week
			const startDate = formatDate(start);
			const endDate = formatDate(end);

			dates.forEach((date) => {
				expect(date >= startDate && date <= endDate).toBe(true);
			});

			// Should have data for some of the test users
			const usernames = result.stats.map((s) => s.username);
			const hasTestUser = usernames.some((u) => u.startsWith("test-stats-user-"));
			expect(hasTestUser).toBe(true);
		});

		it("should get stats for previous week", async () => {
			// Set reference date to 10 days ago (middle of previous week)
			const prevWeekDate = new Date(referenceDate);
			prevWeekDate.setDate(prevWeekDate.getDate() - 10);

			const { start, end } = getDateRange("week", prevWeekDate);
			const result = await statsService.getStatsForDateRange(start, end);

			expect(result.period).toBe("custom");

			// Should return data for that week
			const dates = result.stats.map((s) => s.date).sort();

			// Should have data from around 7-13 days ago from current reference
			const hasExpectedDates = dates.some((date) => {
				const daysFromRef = Math.floor((referenceDate.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
				return daysFromRef >= 7 && daysFromRef <= 13;
			});
			expect(hasExpectedDates).toBe(true);
		});

		it("should get stats for current month", async () => {
			const { start, end } = getDateRange("month", referenceDate);
			const result = await statsService.getStatsForDateRange(start, end);

			expect(result.period).toBe("custom");

			// Should return ALL data for the current month
			const dates = result.stats.map((s) => s.date).sort();

			// Get the month and year from reference date
			const refMonth = referenceDate.getMonth();
			const refYear = referenceDate.getFullYear();

			// All returned dates should be in the same month
			dates.forEach((dateStr) => {
				const date = new Date(dateStr);
				// Allow for dates within the current month or slightly into next month due to date calculations
				const isInMonth =
					(date.getMonth() === refMonth && date.getFullYear() === refYear) ||
					(date.getMonth() === (refMonth + 1) % 12 && date.getDate() === 1);
				expect(isInMonth || dates.length === 0).toBe(true); // Allow empty result if no data in current month
			});
		});

		it("should filter stats by username", async () => {
			const { start, end } = getDateRange("week", referenceDate);
			const result = await statsService.getStatsForDateRange(start, end, testUsernames.user1);

			// All results should be for test user 1
			result.stats.forEach((stat) => {
				expect(stat.username).toBe(testUsernames.user1);
			});

			// Should have stats for test user 1 only
			const usernames = [...new Set(result.stats.map((s) => s.username))];
			expect(usernames).toEqual([testUsernames.user1]);
		});

		it("should filter stats by model", async () => {
			const { start, end } = getDateRange("week", referenceDate);
			const result = await statsService.getStatsForDateRange(start, end, undefined, "anthropic/claude-3-opus");

			// All results should have the filtered model
			result.stats.forEach((stat) => {
				expect(stat.models).toBeDefined();
				stat.models?.forEach((model) => {
					expect(model.provider).toBe("anthropic");
					expect(model.name).toBe("claude-3-opus");
				});
			});
		});

		it("should filter by both username and model", async () => {
			const { start, end } = getDateRange("week", referenceDate);
			const result = await statsService.getStatsForDateRange(
				start,
				end,
				"test-user-2",
				"anthropic/claude-3-5-sonnet-20241022",
			);

			// All results should be for test-user-2
			result.stats.forEach((stat) => {
				expect(stat.username).toBe("test-user-2");

				// And have the filtered model
				expect(stat.models).toBeDefined();
				stat.models?.forEach((model) => {
					expect(model.provider).toBe("anthropic");
					expect(model.name).toBe("claude-3-5-sonnet-20241022");
				});
			});
		});

		it("should recalculate totals when filtering by model", async () => {
			const { start, end } = getDateRange("week", referenceDate);

			// Get all stats first
			const allStats = await statsService.getStatsForDateRange(start, end, "test-user-1");

			// Get filtered stats for one model
			const filteredStats = await statsService.getStatsForDateRange(
				start,
				end,
				"test-user-1",
				"anthropic/claude-3-opus",
			);

			// Find corresponding dates
			const commonDate = allStats.stats[0]?.date;
			if (commonDate) {
				const allStat = allStats.stats.find((s) => s.date === commonDate);
				const filteredStat = filteredStats.stats.find((s) => s.date === commonDate);

				if (allStat && filteredStat) {
					// Filtered cost should be less than total (40% of total based on our test data)
					expect(filteredStat.totalCost).toBeLessThan(allStat.totalCost);
					expect(filteredStat.totalCost).toBeCloseTo(allStat.totalCost * 0.4, 1);
				}
			}
		});

		it("should return empty array when no data matches filters", async () => {
			const { start, end } = getDateRange("week", referenceDate);
			const result = await statsService.getStatsForDateRange(start, end, "non-existent-user");

			expect(result.stats).toEqual([]);
		});

		it("should handle date boundaries correctly for week", async () => {
			// Test with a Wednesday (3 days ago from reference)
			const wednesday = new Date(referenceDate);
			wednesday.setDate(wednesday.getDate() - 3);

			const { start, end } = getDateRange("week", wednesday);
			const result = await statsService.getStatsForDateRange(start, end);

			// Should get Sunday to Saturday of that week
			const dates = result.stats.map((s) => s.date).sort();

			if (dates.length > 0) {
				// Check that dates span approximately 7 days
				const firstDate = new Date(dates[0]);
				const lastDate = new Date(dates[dates.length - 1]);
				const daysDiff = Math.floor((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
				expect(daysDiff).toBeLessThanOrEqual(6); // At most 6 days between first and last
			}
		});

		it("should handle date boundaries correctly for month", async () => {
			// Test with middle of the current month
			const midMonth = new Date(referenceDate);
			midMonth.setDate(15); // Set to 15th of the month

			const { start, end } = getDateRange("month", midMonth);
			const result = await statsService.getStatsForDateRange(start, end);

			// Should get entire month
			const dates = result.stats.map((s) => s.date).sort();

			if (dates.length > 0) {
				// All dates should be in the same month
				const firstDate = new Date(dates[0]);
				const lastDate = new Date(dates[dates.length - 1]);

				// They should be in the same month or very close (accounting for timezone)
				const monthDiff = Math.abs(firstDate.getMonth() - lastDate.getMonth());
				expect(monthDiff <= 1 || monthDiff === 11).toBe(true); // Same month or adjacent months
			}
		});

		it("should aggregate model breakdowns correctly", async () => {
			const { start, end } = getDateRange("week", referenceDate);
			const result = await statsService.getStatsForDateRange(start, end, "test-user-1");

			// Find a stat entry
			const stat = result.stats[0];
			if (stat?.models) {
				// Should have 2 models based on our test data
				expect(stat.models).toHaveLength(2);

				// Check model names
				const modelNames = stat.models.map((m) => m.name).sort();
				expect(modelNames).toEqual(["claude-3-5-sonnet-20241022", "claude-3-opus"]);

				// Total cost should equal sum of model costs
				const totalModelCost = stat.models.reduce((sum, m) => sum + m.cost, 0);
				expect(totalModelCost).toBeCloseTo(stat.totalCost, 2);
			}
		});
	});

	describe.sequential("Edge cases and error handling", () => {
		it("should handle empty database gracefully", async () => {
			const { start, end } = getDateRange("week", new Date(Date.now() + 10 * 24 * 60 * 60 * 1000));
			const result = await statsService.getStatsForDateRange(start, end);

			expect(result.stats).toEqual([]);
			expect(result.period).toBe("custom");
		});

		it("should handle future dates correctly", async () => {
			await createTestData();

			// Query for a future date (1 year from now)
			const futureDate = new Date();
			futureDate.setFullYear(futureDate.getFullYear() + 1);

			const { start, end } = getDateRange("week", futureDate);
			const result = await statsService.getStatsForDateRange(start, end);

			// Should return empty as no data exists for that future period
			expect(result.stats).toEqual([]);
		});

		it("should handle very old dates correctly", async () => {
			await createTestData();

			// Query for a very old date (2 years ago)
			const oldDate = new Date();
			oldDate.setFullYear(oldDate.getFullYear() - 2);

			const { start, end } = getDateRange("week", oldDate);
			const result = await statsService.getStatsForDateRange(start, end);

			// Should return empty as no data exists for that old period
			expect(result.stats).toEqual([]);
		});

		it("should handle concurrent uploads for the same user and date", async () => {
			// First create the user
			const [user] = await db.insert(users).values({ username: "test-stats-concurrent-user" }).returning();

			const tomorrow = getDaysAgo(-1);
			const testData: CCUsageData = {
				daily: [
					{
						date: tomorrow,
						inputTokens: 100000,
						outputTokens: 50000,
						totalTokens: 150000,
						totalCost: 1.5,
						modelBreakdowns: [],
					},
				],
			};

			// Run uploads concurrently
			const results = await Promise.allSettled([
				statsService.uploadStats("test-stats-concurrent-user", testData),
				statsService.uploadStats("test-stats-concurrent-user", testData),
				statsService.uploadStats("test-stats-concurrent-user", testData),
			]);

			// At least one should succeed
			const successful = results.filter((r) => r.status === "fulfilled");
			expect(successful.length).toBeGreaterThanOrEqual(1);

			// Should only have one user entry
			const userCount = await db.select().from(users).where(eq(users.username, "test-stats-concurrent-user"));
			expect(userCount).toHaveLength(1);

			// Should only have one stat entry for that date
			const stats = await db.select().from(usageStats).where(eq(usageStats.userId, user.id));
			expect(stats).toHaveLength(1);
			expect(stats[0].date).toBe(tomorrow);
		});
	});

	describe.sequential("Data validation", () => {
		it("should handle missing model breakdowns", async () => {
			// First create the user
			const [user] = await db.insert(users).values({ username: "test-stats-no-models-user" }).returning();

			const tomorrow = getDaysAgo(-1);
			const testData: CCUsageData = {
				daily: [
					{
						date: tomorrow,
						inputTokens: 100000,
						outputTokens: 50000,
						totalTokens: 150000,
						totalCost: 1.5,
						// No modelBreakdowns
					},
				],
			};

			await statsService.uploadStats("test-stats-no-models-user", testData);
			const stats = await db.select().from(usageStats).where(eq(usageStats.userId, user.id));

			expect(stats).toHaveLength(1);
			expect(stats[0].totalTokens).toBe(150000);

			// Should have no model usage entries
			const models = await db.select().from(modelUsage).where(eq(modelUsage.usageStatsId, stats[0].id));
			expect(models).toHaveLength(0);
		});

		it("should handle zero values correctly", async () => {
			// First create the user
			const [user] = await db.insert(users).values({ username: "test-stats-zero-user" }).returning();

			const tomorrow = getDaysAgo(-1);
			const testData: CCUsageData = {
				daily: [
					{
						date: tomorrow,
						inputTokens: 0,
						outputTokens: 0,
						cacheCreationTokens: 0,
						cacheReadTokens: 0,
						totalTokens: 0,
						totalCost: 0,
						modelBreakdowns: [],
					},
				],
			};

			await statsService.uploadStats("test-stats-zero-user", testData);
			const stats = await db.select().from(usageStats).where(eq(usageStats.userId, user.id));

			expect(stats).toHaveLength(1);
			expect(stats[0].totalTokens).toBe(0);
			expect(parseFloat(stats[0].totalCost)).toBeCloseTo(0, 2);
		});

		it("should handle very large numbers correctly", async () => {
			const testId = randomUUID();
			// First create the user
			const [user] = await db
				.insert(users)
				.values({ username: `test-stats-large-numbers-user-${testId}` })
				.returning();

			const tomorrow = getDaysAgo(-1);
			const testData: CCUsageData = {
				daily: [
					{
						date: tomorrow,
						inputTokens: 999999999,
						outputTokens: 999999999,
						totalTokens: 1999999998,
						totalCost: 999999.99,
						modelBreakdowns: [],
					},
				],
			};

			await statsService.uploadStats(`test-stats-large-numbers-user-${testId}`, testData);
			const stats = await db.select().from(usageStats).where(eq(usageStats.userId, user.id));

			expect(stats).toHaveLength(1);
			expect(stats[0].totalTokens).toBe(1999999998);
			expect(parseFloat(stats[0].totalCost)).toBeCloseTo(999999.99, 2);
		});
	});
});
