import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { StatsService } from "@/api/stats/statsService";
import { TagService } from "@/api/tags/tagService";
import { db, modelUsage, type NewUsageStats, type NewUser, usageStats, users } from "@/db/index";

describe("StatsService Tag Filtering Integration Tests", () => {
	let statsService: StatsService;
	let tagService: TagService;

	// Test users
	let userFrontend: { id: number; username: string };
	let userBackend: { id: number; username: string };
	let userFullstack: { id: number; username: string };
	let userNoTags: { id: number; username: string };

	beforeAll(async () => {
		statsService = new StatsService();
		tagService = new TagService();

		// Create test users
		const testUsers: NewUser[] = [
			{ username: `test-stats-tags-frontend-${Date.now()}` },
			{ username: `test-stats-tags-backend-${Date.now()}` },
			{ username: `test-stats-tags-fullstack-${Date.now()}` },
			{ username: `test-stats-tags-notags-${Date.now()}` },
		];

		const createdUsers = await db.insert(users).values(testUsers).returning();
		userFrontend = createdUsers[0];
		userBackend = createdUsers[1];
		userFullstack = createdUsers[2];
		userNoTags = createdUsers[3];

		// Assign tags to users
		await tagService.setUserTags(userFrontend.id, ["frontend", "javascript", "react"]);
		await tagService.setUserTags(userBackend.id, ["backend", "python", "postgres"]);
		await tagService.setUserTags(userFullstack.id, ["frontend", "backend", "javascript", "python"]);
		// userNoTags has no tags

		// Add usage stats for each user
		const today = new Date().toISOString().split("T")[0];
		const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

		const statsData: NewUsageStats[] = [
			// Frontend user stats
			{
				userId: userFrontend.id,
				date: today,
				inputTokens: 1000,
				outputTokens: 500,
				totalTokens: 1500,
				totalCost: "0.015",
				cacheCreationInputTokens: 0,
				cacheReadInputTokens: 0,
			},
			{
				userId: userFrontend.id,
				date: yesterday,
				inputTokens: 800,
				outputTokens: 400,
				totalTokens: 1200,
				totalCost: "0.012",
				cacheCreationInputTokens: 0,
				cacheReadInputTokens: 0,
			},
			// Backend user stats
			{
				userId: userBackend.id,
				date: today,
				inputTokens: 2000,
				outputTokens: 1000,
				totalTokens: 3000,
				totalCost: "0.030",
				cacheCreationInputTokens: 0,
				cacheReadInputTokens: 0,
			},
			// Fullstack user stats
			{
				userId: userFullstack.id,
				date: today,
				inputTokens: 1500,
				outputTokens: 750,
				totalTokens: 2250,
				totalCost: "0.0225",
				cacheCreationInputTokens: 0,
				cacheReadInputTokens: 0,
			},
			// User with no tags stats
			{
				userId: userNoTags.id,
				date: today,
				inputTokens: 500,
				outputTokens: 250,
				totalTokens: 750,
				totalCost: "0.0075",
				cacheCreationInputTokens: 0,
				cacheReadInputTokens: 0,
			},
		];

		await db.insert(usageStats).values(statsData);
	});

	afterAll(async () => {
		// Clean up test data
		// Delete in order of dependencies
		for (const user of [userFrontend, userBackend, userFullstack, userNoTags]) {
			if (user) {
				// Get all usage stats for this user
				const stats = await db.select().from(usageStats).where(eq(usageStats.userId, user.id));

				// Delete model usage for each stat
				for (const stat of stats) {
					await db.delete(modelUsage).where(eq(modelUsage.usageStatsId, stat.id));
				}

				// Delete usage stats
				await db.delete(usageStats).where(eq(usageStats.userId, user.id));

				// Delete user (tags will cascade delete)
				await db.delete(users).where(eq(users.id, user.id));
			}
		}
	});

	describe("getStatsForDateRange with tags", () => {
		it("should filter stats by single tag", async () => {
			const startDate = new Date(Date.now() - 7 * 86400000); // 7 days ago
			const endDate = new Date();

			// Get stats for users with "frontend" tag
			const result = await statsService.getStatsForDateRange(startDate, endDate, undefined, undefined, ["frontend"]);

			// Should return stats for userFrontend and userFullstack
			const usernames = [...new Set(result.stats.map((s) => s.username))];
			expect(usernames).toHaveLength(2);
			expect(usernames).toContain(userFrontend.username);
			expect(usernames).toContain(userFullstack.username);
			expect(usernames).not.toContain(userBackend.username);
			expect(usernames).not.toContain(userNoTags.username);
		});

		it("should filter stats by multiple tags (AND logic)", async () => {
			const startDate = new Date(Date.now() - 7 * 86400000);
			const endDate = new Date();

			// Get stats for users with BOTH "frontend" AND "backend" tags
			const result = await statsService.getStatsForDateRange(startDate, endDate, undefined, undefined, [
				"frontend",
				"backend",
			]);

			// Should only return stats for userFullstack
			const usernames = [...new Set(result.stats.map((s) => s.username))];
			expect(usernames).toHaveLength(1);
			expect(usernames).toContain(userFullstack.username);
		});

		it("should return empty stats when no users have all specified tags", async () => {
			const startDate = new Date(Date.now() - 7 * 86400000);
			const endDate = new Date();

			// Search for tags that no user has all of them
			const result = await statsService.getStatsForDateRange(
				startDate,
				endDate,
				undefined,
				undefined,
				["frontend", "postgres"], // No user has both
			);

			expect(result.stats).toHaveLength(0);
			expect(result.summary?.totalCost).toBe(0);
			expect(result.summary?.totalTokens).toBe(0);
			expect(result.summary?.uniqueUsers).toBe(0);
		});

		it("should combine username and tag filters", async () => {
			const startDate = new Date(Date.now() - 7 * 86400000);
			const endDate = new Date();

			// Get stats for specific user with tag filter
			const result = await statsService.getStatsForDateRange(startDate, endDate, userFullstack.username, undefined, [
				"backend",
			]);

			// Should return stats only for userFullstack (has the tag and matches username)
			const usernames = [...new Set(result.stats.map((s) => s.username))];
			expect(usernames).toHaveLength(1);
			expect(usernames[0]).toBe(userFullstack.username);
		});

		it("should return empty when username doesn't have specified tags", async () => {
			const startDate = new Date(Date.now() - 7 * 86400000);
			const endDate = new Date();

			// userFrontend doesn't have "backend" tag
			const result = await statsService.getStatsForDateRange(startDate, endDate, userFrontend.username, undefined, [
				"backend",
			]);

			expect(result.stats).toHaveLength(0);
		});
	});

	describe("getAllStats with tags", () => {
		it("should filter all stats by single tag", async () => {
			// Get all stats for users with "javascript" tag
			const result = await statsService.getAllStats(undefined, undefined, ["javascript"]);

			// Should return stats for userFrontend and userFullstack
			const usernames = [...new Set(result.stats.map((s) => s.username))];
			expect(usernames).toHaveLength(2);
			expect(usernames).toContain(userFrontend.username);
			expect(usernames).toContain(userFullstack.username);
		});

		it("should filter all stats by multiple tags", async () => {
			// Get all stats for users with both "javascript" AND "python" tags
			const result = await statsService.getAllStats(undefined, undefined, ["javascript", "python"]);

			// Should only return stats for userFullstack
			const usernames = [...new Set(result.stats.map((s) => s.username))];
			expect(usernames).toHaveLength(1);
			expect(usernames).toContain(userFullstack.username);
		});

		it("should return all stats when no tags specified", async () => {
			// Get all stats without tag filter
			const result = await statsService.getAllStats();

			// Should return stats for all users (including our test users)
			const usernames = [...new Set(result.stats.map((s) => s.username))];

			// Check that our test users are included
			const testUsernames = [userFrontend.username, userBackend.username, userFullstack.username, userNoTags.username];

			const hasTestUsers = testUsernames.some((username) => usernames.includes(username));
			expect(hasTestUsers).toBe(true);
		});

		it("should handle case-insensitive tag filtering", async () => {
			// Search with different case
			const result = await statsService.getAllStats(undefined, undefined, ["Frontend"]);

			// Should still find users with "frontend" tag
			const usernames = [...new Set(result.stats.map((s) => s.username))];
			expect(usernames).toContain(userFrontend.username);
			expect(usernames).toContain(userFullstack.username);
		});

		it("should correctly calculate summary with tag filtering", async () => {
			// Get stats for backend users
			const result = await statsService.getAllStats(undefined, undefined, ["backend"]);

			// Filter to only our test users
			const testUserStats = result.stats.filter((s) => s.username.startsWith("test-stats-tags-"));
			const uniqueTestUsers = new Set(testUserStats.map((s) => s.username));

			// Verify we have the correct test users with backend tag
			expect(uniqueTestUsers.has(userBackend.username)).toBe(true);
			expect(uniqueTestUsers.has(userFullstack.username)).toBe(true);
			expect(uniqueTestUsers.has(userFrontend.username)).toBe(false);
			expect(uniqueTestUsers.has(userNoTags.username)).toBe(false);

			// The summary includes ALL users with backend tag (including from other tests)
			// So we just verify it has at least our 2 test users
			expect(result.summary?.uniqueUsers).toBeGreaterThanOrEqual(2);
			expect(result.summary?.totalTokens).toBeGreaterThan(0);
			expect(result.summary?.totalCost).toBeGreaterThan(0);

			// Total cost should include at least our test users' costs
			const expectedMinCost = 0.03 + 0.0225; // Today's costs for backend and fullstack
			expect(result.summary?.totalCost).toBeGreaterThanOrEqual(expectedMinCost);
		});
	});

	describe("Edge cases", () => {
		it("should handle empty tag array", async () => {
			const startDate = new Date(Date.now() - 7 * 86400000);
			const endDate = new Date();

			// Empty tags array should not filter
			const result = await statsService.getStatsForDateRange(startDate, endDate, undefined, undefined, []);

			// Should return stats for all users
			expect(result.stats.length).toBeGreaterThan(0);
		});

		it("should handle non-existent tags", async () => {
			const result = await statsService.getAllStats(undefined, undefined, ["nonexistent-tag-xyz"]);

			expect(result.stats).toHaveLength(0);
			expect(result.summary?.totalCost).toBe(0);
			expect(result.summary?.uniqueUsers).toBe(0);
		});

		it("should preserve other filters when using tags", async () => {
			const startDate = new Date(Date.now() - 7 * 86400000);
			const endDate = new Date();

			// Combine all filters: date range, username, and tags
			const result = await statsService.getStatsForDateRange(startDate, endDate, userFullstack.username, undefined, [
				"javascript",
			]);

			// Should only return stats for userFullstack within date range
			if (result.stats.length > 0) {
				const usernames = [...new Set(result.stats.map((s) => s.username))];
				expect(usernames).toHaveLength(1);
				expect(usernames[0]).toBe(userFullstack.username);

				// Check dates are within range
				result.stats.forEach((stat) => {
					const statDate = new Date(stat.date);
					expect(statDate >= startDate).toBe(true);
					expect(statDate <= endDate).toBe(true);
				});
			}
		});
	});
});
