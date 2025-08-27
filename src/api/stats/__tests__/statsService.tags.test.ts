import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { StatsService } from "@/api/stats/statsService";
import type { StatsResponse } from "@/api/stats/statsTypes";
import { TagService } from "@/api/tags/tagService";
import { db, type NewUsageStats, type NewUser, usageStats, users } from "@/db/index";
import { cleanupTestDatabase } from "@/test-utils/cleanupTestDatabase";

describe("StatsService Tag Filtering Integration Tests", () => {
  let statsService: StatsService;
  let tagService: TagService;

  // Test users
  let userFrontend: { id: number; username: string };
  let userBackend: { id: number; username: string };
  let userFullstack: { id: number; username: string };
  let userNoTags: { id: number; username: string };

  function assertEmptyStatsResult(result: StatsResponse): void {
    expect(result.stats).toHaveLength(0);
    expect(result.summary?.totalCost).toBe(0);
    expect(result.summary?.totalTokens).toBe(0);
    expect(result.summary?.uniqueUsers).toBe(0);
  }

  function assertExactTestUsers(result: StatsResponse, expectedUsernames: string[]): void {
    const usernames = [...new Set(result.stats.map((s) => s.username))];
    expect(usernames).toHaveLength(expectedUsernames.length);
    expectedUsernames.forEach((username) => {
      expect(usernames).toContain(username);
    });
    expect(usernames.sort()).toEqual(expectedUsernames.sort());

    // Calculate expected totals based on which users are expected
    let expectedTotalTokens = 0;
    let expectedTotalCost = 0;

    if (expectedUsernames.includes(userFrontend.username)) {
      // Frontend user has 2 days of stats: today (1500) + yesterday (1200) = 2700 tokens
      expectedTotalTokens += 2700;
      expectedTotalCost += 0.027; // 0.015 + 0.012
    }
    if (expectedUsernames.includes(userBackend.username)) {
      // Backend user has 1 day: today (3000 tokens)
      expectedTotalTokens += 3000;
      expectedTotalCost += 0.03;
    }
    if (expectedUsernames.includes(userFullstack.username)) {
      // Fullstack user has 1 day: today (2250 tokens)
      expectedTotalTokens += 2250;
      expectedTotalCost += 0.0225;
    }
    if (expectedUsernames.includes(userNoTags.username)) {
      // NoTags user has 1 day: today (750 tokens)
      expectedTotalTokens += 750;
      expectedTotalCost += 0.0075;
    }

    // Assert the summary matches expected totals
    if (result.summary) {
      expect(result.summary.uniqueUsers).toBe(expectedUsernames.length);
      expect(result.summary.totalTokens).toBe(expectedTotalTokens);
      expect(result.summary.totalCost).toBeCloseTo(expectedTotalCost, 4);
    }
  }

  function assertAllTestUsers(result: StatsResponse): void {
    assertExactTestUsers(result, [
      userFrontend.username,
      userBackend.username,
      userFullstack.username,
      userNoTags.username,
    ]);
  }

  beforeAll(async () => {
    statsService = new StatsService();
    tagService = new TagService();

    await cleanupTestDatabase();

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
    await cleanupTestDatabase();
  });

  describe("getStatsForDateRange with tags", () => {
    it("should filter stats by single tag", async () => {
      const startDate = new Date(Date.now() - 7 * 86400000); // 7 days ago
      const endDate = new Date();

      // Get stats for users with "frontend" tag
      const result = await statsService.getStatsForDateRange(startDate, endDate, undefined, undefined, ["frontend"]);

      // Should return stats for userFrontend and userFullstack
      assertExactTestUsers(result, [userFrontend.username, userFullstack.username]);
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
      assertExactTestUsers(result, [userFullstack.username]);
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

      assertEmptyStatsResult(result);
    });

    it("should combine username and tag filters", async () => {
      const startDate = new Date(Date.now() - 7 * 86400000);
      const endDate = new Date();

      // Get stats for specific user with tag filter
      const result = await statsService.getStatsForDateRange(startDate, endDate, userFullstack.username, undefined, [
        "backend",
      ]);

      // Should return stats only for userFullstack (has the tag and matches username)
      assertExactTestUsers(result, [userFullstack.username]);
    });

    it("should return empty when username doesn't have specified tags", async () => {
      const startDate = new Date(Date.now() - 7 * 86400000);
      const endDate = new Date();

      // userFrontend doesn't have "backend" tag
      const result = await statsService.getStatsForDateRange(startDate, endDate, userFrontend.username, undefined, [
        "backend",
      ]);

      assertEmptyStatsResult(result);
    });
  });

  describe("getAllStats with tags", () => {
    it("should filter all stats by single tag", async () => {
      // Get all stats for users with "javascript" tag
      const result = await statsService.getAllStats(undefined, undefined, ["javascript"]);

      // Should return stats for userFrontend and userFullstack
      assertExactTestUsers(result, [userFrontend.username, userFullstack.username]);
    });

    it("should filter all stats by multiple tags", async () => {
      // Get all stats for users with both "javascript" AND "python" tags
      const result = await statsService.getAllStats(undefined, undefined, ["javascript", "python"]);

      // Should only return stats for userFullstack
      assertExactTestUsers(result, [userFullstack.username]);
    });

    it("should return all stats when no tags specified", async () => {
      // Get all stats without tag filter - should include all our test users
      const result = await statsService.getAllStats();

      // Verify all test users are present with correct totals
      assertAllTestUsers(result);
    });

    it("should handle case-insensitive tag filtering", async () => {
      // Search with different case
      const result = await statsService.getAllStats(undefined, undefined, ["Frontend"]);

      // Should still find users with "frontend" tag
      assertExactTestUsers(result, [userFrontend.username, userFullstack.username]);
    });

    it("should correctly calculate summary with tag filtering", async () => {
      // Get stats for backend users
      const result = await statsService.getAllStats(undefined, undefined, ["backend"]);

      // Verify we have exactly the test users with backend tag and correct totals
      assertExactTestUsers(result, [userBackend.username, userFullstack.username]);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty tag array", async () => {
      const startDate = new Date(Date.now() - 7 * 86400000);
      const endDate = new Date();

      // Empty tags array should not filter
      const result = await statsService.getStatsForDateRange(startDate, endDate, undefined, undefined, []);

      // Should return stats for all test users
      assertAllTestUsers(result);
    });

    it("should handle non-existent tags", async () => {
      const result = await statsService.getAllStats(undefined, undefined, ["nonexistent-tag-xyz"]);

      assertEmptyStatsResult(result);
    });

    it("should preserve other filters when using tags", async () => {
      const startDate = new Date(Date.now() - 7 * 86400000);
      const endDate = new Date();

      // Combine all filters: date range, username, and tags
      const result = await statsService.getStatsForDateRange(startDate, endDate, userFullstack.username, undefined, [
        "javascript",
      ]);

      // Should only return stats for userFullstack
      assertExactTestUsers(result, [userFullstack.username]);

      // Also verify dates are within range
      result.stats.forEach((stat) => {
        const statDate = new Date(stat.date);
        expect(statDate >= startDate).toBe(true);
        expect(statDate <= endDate).toBe(true);
      });
    });
  });
});
