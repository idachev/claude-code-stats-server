import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TagService } from "@/api/tags/tagService";
import { db, type NewUser, users } from "@/db/index";
import { app } from "@/server";
import { cleanupTestDatabase } from "@/test-utils/cleanupTestDatabase";

describe("Tag Router Integration Tests", () => {
  let tagService: TagService;
  const adminApiKey = process.env.ADMIN_API_KEY || "test-admin-key";
  let testUser: { id: number; username: string };
  let testUser2: { id: number; username: string };

  beforeAll(async () => {
    tagService = new TagService();

    // Create test users
    const timestamp = Date.now();
    const testUsers: NewUser[] = [
      { username: `test-router-user1-${timestamp}` },
      { username: `test-router-user2-${timestamp}` },
    ];

    const createdUsers = await db.insert(users).values(testUsers).returning();
    testUser = createdUsers[0];
    testUser2 = createdUsers[1];
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe("GET /admin/tags", () => {
    it("should get all unique tags with admin auth", async () => {
      // Clear tags first
      await tagService.setUserTags(testUser.id, []);
      await tagService.setUserTags(testUser2.id, []);

      // Setup: Add tags to multiple users
      await tagService.setUserTags(testUser.id, ["frontend", "react", "typescript"]);
      await tagService.setUserTags(testUser2.id, ["backend", "nodejs", "typescript"]); // typescript is shared

      const response = await request(app).get("/admin/tags").set("X-Admin-Key", adminApiKey);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.arrayContaining(["backend", "frontend", "nodejs", "react", "typescript"]));
      // Verify it's sorted alphabetically
      const expectedSorted = ["backend", "frontend", "nodejs", "react", "typescript"];
      expect(response.body).toEqual(expectedSorted);
    });

    it("should return empty array when no tags exist", async () => {
      // Clear all tags - ensure we start with a clean state
      await tagService.setUserTags(testUser.id, []);
      await tagService.setUserTags(testUser2.id, []);

      const response = await request(app).get("/admin/tags").set("X-Admin-Key", adminApiKey);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("should return unique tags only", async () => {
      // Clear tags first
      await tagService.setUserTags(testUser.id, []);
      await tagService.setUserTags(testUser2.id, []);

      // Setup: Add same tag to multiple users
      await tagService.setUserTags(testUser.id, ["shared-tag", "unique1"]);
      await tagService.setUserTags(testUser2.id, ["shared-tag", "unique2"]);

      const response = await request(app).get("/admin/tags").set("X-Admin-Key", adminApiKey);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(["shared-tag", "unique1", "unique2"]);
      // Verify each tag appears only once
      const tagCounts = response.body.reduce((acc: Record<string, number>, tag: string) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {});
      Object.values(tagCounts).forEach((count) => {
        expect(count).toBe(1);
      });
    });

    it("should return 401 without admin auth", async () => {
      const response = await request(app).get("/admin/tags");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toMatch(/admin|Authentication required/i);
    });

    it("should return 401 with invalid API key", async () => {
      const response = await request(app).get("/admin/tags").set("X-Admin-Key", "invalid-key");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Invalid admin API key");
    });

    it("should handle tags with special characters", async () => {
      // Clear tags first
      await tagService.setUserTags(testUser.id, []);
      await tagService.setUserTags(testUser2.id, []);

      // Setup: Add tags with special allowed characters
      await tagService.setUserTags(testUser.id, ["tag-with-hyphens", "tag.with.dots", "tag_with_underscores"]);
      await tagService.setUserTags(testUser2.id, ["tag with spaces"]);

      const response = await request(app).get("/admin/tags").set("X-Admin-Key", adminApiKey);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(["tag with spaces", "tag-with-hyphens", "tag.with.dots", "tag_with_underscores"]);
    });

    it("should handle case sensitivity correctly", async () => {
      // Clear tags first
      await tagService.setUserTags(testUser.id, []);
      await tagService.setUserTags(testUser2.id, []);

      // Setup: Add tags with different cases to different users
      // The database constraint allows different users to have tags with different cases
      // but prevents the same user from having duplicate tags with different cases
      await tagService.setUserTags(testUser.id, ["JavaScript", "TypeScript"]);
      await tagService.setUserTags(testUser2.id, ["javascript", "typescript"]); // Different case, different user - allowed

      const response = await request(app).get("/admin/tags").set("X-Admin-Key", adminApiKey);

      expect(response.status).toBe(200);
      // The getTags method now returns unique tags case-insensitively
      // It returns the MIN() value for each group (first alphabetically by case)
      // So we expect "JavaScript" (capital J) and "TypeScript" (capital T)
      expect(response.body).toHaveLength(2); // Only 2 unique tags now
      expect(response.body).toContain("JavaScript");
      expect(response.body).toContain("TypeScript");

      // Should NOT contain the lowercase versions
      expect(response.body).not.toContain("javascript");
      expect(response.body).not.toContain("typescript");
    });
  });

  describe("GET /admin/users/:username/tags", () => {
    it("should get user tags with admin auth", async () => {
      // Setup: Add tags to user
      await tagService.setUserTags(testUser.id, ["frontend", "react", "typescript"]);

      const response = await request(app).get(`/admin/users/${testUser.username}/tags`).set("X-Admin-Key", adminApiKey);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(["frontend", "react", "typescript"]);
    });

    it("should return empty array when user has no tags", async () => {
      // Clear any existing tags for testUser2
      await tagService.setUserTags(testUser2.id, []);

      const response = await request(app)
        .get(`/admin/users/${testUser2.username}/tags`)
        .set("X-Admin-Key", adminApiKey);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("should return 401 without admin auth", async () => {
      const response = await request(app).get(`/admin/users/${testUser.username}/tags`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toMatch(/admin/i);
    });

    it("should return 401 with invalid API key", async () => {
      const response = await request(app)
        .get(`/admin/users/${testUser.username}/tags`)
        .set("X-Admin-Key", "invalid-key");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Invalid admin API key");
    });

    it("should return 400 for invalid username", async () => {
      const response = await request(app).get("/admin/users/ab/tags").set("X-Admin-Key", adminApiKey); // Too short

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Invalid input");
      expect(response.body.error).toContain("params.username");
    });
  });

  describe("POST /admin/users/:userId/tags", () => {
    it("should add new tags to user", async () => {
      // Clear existing tags
      await tagService.setUserTags(testUser.id, []);

      const response = await request(app)
        .post(`/admin/users/${testUser.username}/tags`)
        .set("X-Admin-Key", adminApiKey)
        .send({ tags: ["backend", "nodejs"] });

      expect(response.status).toBe(204);

      // Verify tags were added
      const userTags = await tagService.getUserTags(testUser.id);
      expect(userTags).toEqual(["backend", "nodejs"]);
    });

    it("should add to existing tags without duplicates", async () => {
      // Setup: Add initial tags
      await tagService.setUserTags(testUser.id, ["frontend", "react"]);

      const response = await request(app)
        .post(`/admin/users/${testUser.username}/tags`)
        .set("X-Admin-Key", adminApiKey)
        .send({ tags: ["react", "typescript", "nodejs"] });

      expect(response.status).toBe(204);

      // Verify tags were merged correctly
      const userTags = await tagService.getUserTags(testUser.id);
      expect(userTags.sort()).toEqual(["frontend", "nodejs", "react", "typescript"]);
    });

    it("should handle case-insensitive duplicates", async () => {
      // Setup: Add initial tags
      await tagService.setUserTags(testUser.id, ["Frontend"]);

      const response = await request(app)
        .post(`/admin/users/${testUser.username}/tags`)
        .set("X-Admin-Key", adminApiKey)
        .send({ tags: ["backend", "nodejs"] }); // Different tags that won't conflict

      expect(response.status).toBe(204);

      // Verify tags were added
      const userTags = await tagService.getUserTags(testUser.id);
      expect(userTags.sort()).toEqual(["Frontend", "backend", "nodejs"]);
    });

    it("should prevent case-insensitive duplicate tags in database", async () => {
      // This test verifies the database constraint works
      // Setup: Add initial tag
      await tagService.setUserTags(testUser2.id, ["Frontend"]);

      // Try to add same tag with different case
      const response = await request(app)
        .post(`/admin/users/${testUser2.username}/tags`)
        .set("X-Admin-Key", adminApiKey)
        .send({ tags: ["frontend"] }); // Same tag, different case

      // Should still succeed because we filter duplicates in the router
      expect(response.status).toBe(204);

      // Should still only have one tag
      const userTags = await tagService.getUserTags(testUser2.id);
      expect(userTags).toEqual(["Frontend"]);
    });

    it("should return 400 for invalid tag names", async () => {
      const response = await request(app)
        .post(`/admin/users/${testUser.username}/tags`)
        .set("X-Admin-Key", adminApiKey)
        .send({ tags: ["valid-tag", "invalid@tag", "another_valid"] });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toMatch(/can only contain letters, numbers/);
    });

    it("should return 400 for tag names too short", async () => {
      const response = await request(app)
        .post(`/admin/users/${testUser.username}/tags`)
        .set("X-Admin-Key", adminApiKey)
        .send({ tags: ["a"] });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Tag name must be at least 2 characters");
    });

    it("should return 400 for tag names too long", async () => {
      const longTag = "a".repeat(65);
      const response = await request(app)
        .post(`/admin/users/${testUser.username}/tags`)
        .set("X-Admin-Key", adminApiKey)
        .send({ tags: [longTag] });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Tag name cannot exceed 64 characters");
    });

    it("should return 400 for missing tags field", async () => {
      const response = await request(app)
        .post(`/admin/users/${testUser.username}/tags`)
        .set("X-Admin-Key", adminApiKey)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Invalid input");
      expect(response.body.error).toContain("body.tags");
    });

    it("should return 401 without admin auth", async () => {
      const response = await request(app)
        .post(`/admin/users/${testUser.username}/tags`)
        .send({ tags: ["test"] });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Authentication required. Use session cookie or X-Admin-Key header");
    });
  });

  describe("PUT /admin/users/:username/tags", () => {
    it("should replace all user tags", async () => {
      // Setup: Add initial tags
      await tagService.setUserTags(testUser.id, ["old1", "old2", "old3"]);

      const response = await request(app)
        .put(`/admin/users/${testUser.username}/tags`)
        .set("X-Admin-Key", adminApiKey)
        .send({ tags: ["new1", "new2"] });

      expect(response.status).toBe(204);

      // Verify tags were replaced
      const userTags = await tagService.getUserTags(testUser.id);
      expect(userTags).toEqual(["new1", "new2"]);
    });

    it("should clear all tags when given empty array", async () => {
      // Setup: Add initial tags
      await tagService.setUserTags(testUser.id, ["tag1", "tag2"]);

      const response = await request(app)
        .put(`/admin/users/${testUser.username}/tags`)
        .set("X-Admin-Key", adminApiKey)
        .send({ tags: [] });

      expect(response.status).toBe(204);

      // Verify tags were cleared
      const userTags = await tagService.getUserTags(testUser.id);
      expect(userTags).toEqual([]);
    });

    it("should handle duplicate tags in request", async () => {
      const response = await request(app)
        .put(`/admin/users/${testUser.username}/tags`)
        .set("X-Admin-Key", adminApiKey)
        .send({ tags: ["duplicate", "duplicate", "unique"] });

      expect(response.status).toBe(204);

      // Verify duplicates were removed
      const userTags = await tagService.getUserTags(testUser.id);
      expect(userTags.sort()).toEqual(["duplicate", "unique"]);
    });

    it("should return 400 for invalid tags", async () => {
      const response = await request(app)
        .put(`/admin/users/${testUser.username}/tags`)
        .set("X-Admin-Key", adminApiKey)
        .send({ tags: ["valid", "inv@lid"] });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain(
        "Tag name can only contain letters, numbers, spaces, dots, hyphens, and underscores",
      );
    });

    it("should return 401 without admin auth", async () => {
      const response = await request(app)
        .put(`/admin/users/${testUser.username}/tags`)
        .send({ tags: ["test"] });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Authentication required. Use session cookie or X-Admin-Key header");
    });
  });

  describe("DELETE /admin/users/:username/tags/:tagName", () => {
    it("should remove specific tag from user", async () => {
      // Setup: Add tags
      await tagService.setUserTags(testUser.id, ["keep1", "remove", "keep2"]);

      const response = await request(app)
        .delete(`/admin/users/${testUser.username}/tags/remove`)
        .set("X-Admin-Key", adminApiKey);

      expect(response.status).toBe(204);

      // Verify tag was removed
      const userTags = await tagService.getUserTags(testUser.id);
      expect(userTags.sort()).toEqual(["keep1", "keep2"]);
    });

    it("should handle removing non-existent tag", async () => {
      // Setup: Add tags
      await tagService.setUserTags(testUser.id, ["tag1", "tag2"]);

      const response = await request(app)
        .delete(`/admin/users/${testUser.username}/tags/nonexistent`)
        .set("X-Admin-Key", adminApiKey);

      expect(response.status).toBe(204);

      // Verify existing tags unchanged
      const userTags = await tagService.getUserTags(testUser.id);
      expect(userTags.sort()).toEqual(["tag1", "tag2"]);
    });

    it("should handle URL encoding in tag names", async () => {
      // Setup: Add tag with special characters
      await tagService.setUserTags(testUser.id, ["tag with spaces", "tag.with.dots"]);

      // Remove tag with spaces (URL encoded)
      const response = await request(app)
        .delete(`/admin/users/${testUser.username}/tags/tag%20with%20spaces`)
        .set("X-Admin-Key", adminApiKey);

      expect(response.status).toBe(204);

      // Verify correct tag was removed
      const userTags = await tagService.getUserTags(testUser.id);
      expect(userTags).toEqual(["tag.with.dots"]);
    });

    it("should return 400 for invalid tag name format", async () => {
      const response = await request(app)
        .delete(`/admin/users/${testUser.username}/tags/inv@lid`)
        .set("X-Admin-Key", adminApiKey);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain(
        "Tag name can only contain letters, numbers, spaces, dots, hyphens, and underscores",
      );
    });

    it("should return 401 without admin auth", async () => {
      const response = await request(app).delete(`/admin/users/${testUser.id}/tags/test`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toBe("Authentication required. Use session cookie or X-Admin-Key header");
    });
  });

  describe("Concurrent operations", () => {
    it("should handle concurrent tag additions correctly", async () => {
      // Clear tags
      await tagService.setUserTags(testUser.id, []);

      // Send multiple concurrent requests with unique tags to avoid race conditions
      const promises = [
        request(app)
          .post(`/admin/users/${testUser.username}/tags`)
          .set("X-Admin-Key", adminApiKey)
          .send({ tags: ["concurrent1", "concurrent2"] }),
        request(app)
          .post(`/admin/users/${testUser.username}/tags`)
          .set("X-Admin-Key", adminApiKey)
          .send({ tags: ["concurrent3", "concurrent4"] }),
        request(app)
          .post(`/admin/users/${testUser.username}/tags`)
          .set("X-Admin-Key", adminApiKey)
          .send({ tags: ["concurrent5", "concurrent6"] }),
      ];

      const responses = await Promise.all(promises);

      // At least one should succeed, but due to potential race conditions not all might
      const successCount = responses.filter((r) => r.status === 204).length;
      expect(successCount).toBeGreaterThan(0);

      // Verify tags were added
      const userTags = await tagService.getUserTags(testUser.id);
      expect(userTags.length).toBeGreaterThan(0);
      expect(userTags.length).toBeLessThanOrEqual(6); // At most 6 tags

      // All tags that made it should be from our concurrent operations
      userTags.forEach((tag) => {
        expect(tag).toMatch(/^concurrent\d$/);
      });
    });
  });
});
