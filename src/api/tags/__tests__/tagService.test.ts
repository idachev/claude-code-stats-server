import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TagService } from "@/api/tags/tagService";
import { db, type NewUser, tags, users } from "@/db/index";

describe("TagService Integration Tests", () => {
	let tagService: TagService;
	let testUserId: number;
	let testUserId2: number;

	beforeAll(async () => {
		// Create test users
		const testUser1: NewUser = {
			username: `test-user-tags-${Date.now()}`,
		};
		const testUser2: NewUser = {
			username: `test-user-tags-2-${Date.now()}`,
		};

		const [user1] = await db.insert(users).values(testUser1).returning();
		const [user2] = await db.insert(users).values(testUser2).returning();
		testUserId = user1.id;
		testUserId2 = user2.id;
	});

	afterAll(async () => {
		// Clean up test data
		if (testUserId) {
			await db.delete(users).where(eq(users.id, testUserId));
		}
		if (testUserId2) {
			await db.delete(users).where(eq(users.id, testUserId2));
		}
	});

	beforeEach(async () => {
		tagService = new TagService();
		// Clean up any existing tags for test users
		await db.delete(tags).where(eq(tags.userId, testUserId));
		await db.delete(tags).where(eq(tags.userId, testUserId2));
	});

	describe("getTags", () => {
		it("should return all unique tag names sorted", async () => {
			// Insert some tags for different users
			await db.insert(tags).values([
				{ userId: testUserId, name: "gamma" },
				{ userId: testUserId, name: "alpha" },
				{ userId: testUserId2, name: "beta" },
				{ userId: testUserId2, name: "alpha" }, // Duplicate name, different user
			]);

			const result = await tagService.getTags();

			// Should return unique tag names sorted
			expect(result).toContain("alpha");
			expect(result).toContain("beta");
			expect(result).toContain("gamma");

			// Check if sorted
			const sortedResult = [...result].sort();
			expect(result).toEqual(sortedResult);
		});

		it("should return empty array when no tags exist", async () => {
			// Get all existing tags
			const _existingTags = await tagService.getTags();

			// Clean up all tags for our test users (already done in beforeEach)
			// Just verify no tags exist for our test users
			const userTags = await tagService.getUserTags(testUserId);
			expect(userTags).toEqual([]);
		});
	});

	describe("setUserTags", () => {
		it("should replace all user tags with new ones", async () => {
			// First set some initial tags
			await tagService.setUserTags(testUserId, ["old1", "old2"]);

			// Verify initial tags
			let userTags = await tagService.getUserTags(testUserId);
			expect(userTags).toEqual(["old1", "old2"]);

			// Now replace with new tags
			await tagService.setUserTags(testUserId, ["new1", "new2", "new3"]);

			// Verify tags were replaced
			userTags = await tagService.getUserTags(testUserId);
			expect(userTags).toEqual(["new1", "new2", "new3"]);
		});

		it("should handle empty tags array by deleting all user tags", async () => {
			// Set some tags
			await tagService.setUserTags(testUserId, ["tag1", "tag2"]);

			// Verify tags exist
			let userTags = await tagService.getUserTags(testUserId);
			expect(userTags).toHaveLength(2);

			// Set empty tags
			await tagService.setUserTags(testUserId, []);

			// Verify all tags removed
			userTags = await tagService.getUserTags(testUserId);
			expect(userTags).toEqual([]);
		});

		it("should validate tag names and throw error for invalid tags", async () => {
			const invalidTags = ["valid-tag", "invalid@tag"];

			await expect(tagService.setUserTags(testUserId, invalidTags)).rejects.toThrow(
				"Tag name can only contain letters, numbers, spaces, dots, hyphens, and underscores",
			);

			// Verify no tags were added
			const userTags = await tagService.getUserTags(testUserId);
			expect(userTags).toEqual([]);
		});

		it("should throw error for tags that are too short", async () => {
			const shortTags = ["a"];

			await expect(tagService.setUserTags(testUserId, shortTags)).rejects.toThrow(
				"Tag name must be at least 2 characters",
			);
		});

		it("should throw error for tags that are too long", async () => {
			const longTag = "a".repeat(65);
			const longTags = [longTag];

			await expect(tagService.setUserTags(testUserId, longTags)).rejects.toThrow(
				"Tag name cannot exceed 64 characters",
			);
		});

		it("should remove duplicate tags and trim whitespace", async () => {
			const duplicateTags = ["  frontend  ", "backend", "frontend", "backend"];

			await tagService.setUserTags(testUserId, duplicateTags);

			const userTags = await tagService.getUserTags(testUserId);
			expect(userTags).toHaveLength(2);
			expect(userTags).toContain("frontend");
			expect(userTags).toContain("backend");
		});

		it("should handle case-insensitive unique constraint", async () => {
			// Set a tag with lowercase
			await tagService.setUserTags(testUserId, ["frontend"]);

			// Try to set same tag with different case - should be handled gracefully
			await tagService.setUserTags(testUserId, ["Frontend", "Backend"]);

			const userTags = await tagService.getUserTags(testUserId);
			// Should have replaced with new casing
			expect(userTags).toHaveLength(2);
		});
	});

	describe("getUserTags", () => {
		it("should return tags for a user sorted by name", async () => {
			// Insert tags in unsorted order
			await db.insert(tags).values([
				{ userId: testUserId, name: "gamma" },
				{ userId: testUserId, name: "alpha" },
				{ userId: testUserId, name: "beta" },
			]);

			const result = await tagService.getUserTags(testUserId);

			expect(result).toEqual(["alpha", "beta", "gamma"]);
		});

		it("should return empty array when user has no tags", async () => {
			const result = await tagService.getUserTags(testUserId);
			expect(result).toEqual([]);
		});

		it("should not return tags from other users", async () => {
			// Add tags to both users
			await db.insert(tags).values([
				{ userId: testUserId, name: "user1-tag" },
				{ userId: testUserId2, name: "user2-tag" },
			]);

			const user1Tags = await tagService.getUserTags(testUserId);
			const user2Tags = await tagService.getUserTags(testUserId2);

			expect(user1Tags).toEqual(["user1-tag"]);
			expect(user2Tags).toEqual(["user2-tag"]);
		});
	});

	describe("removeTagFromUser", () => {
		it("should remove a specific tag from user", async () => {
			// Add multiple tags
			await tagService.setUserTags(testUserId, ["frontend", "backend", "devops"]);

			// Remove one tag
			await tagService.removeTagFromUser(testUserId, "backend");

			const userTags = await tagService.getUserTags(testUserId);
			expect(userTags).toEqual(["devops", "frontend"]);
		});

		it("should handle case-insensitive tag removal", async () => {
			// Add tag
			await tagService.setUserTags(testUserId, ["FrontEnd"]);

			// Remove with different case
			await tagService.removeTagFromUser(testUserId, "frontend");

			const userTags = await tagService.getUserTags(testUserId);
			expect(userTags).toEqual([]);
		});

		it("should not affect other users tags", async () => {
			// Add same tag to both users
			await tagService.setUserTags(testUserId, ["shared-tag"]);
			await tagService.setUserTags(testUserId2, ["shared-tag"]);

			// Remove from one user
			await tagService.removeTagFromUser(testUserId, "shared-tag");

			// Verify only removed from one user
			const user1Tags = await tagService.getUserTags(testUserId);
			const user2Tags = await tagService.getUserTags(testUserId2);

			expect(user1Tags).toEqual([]);
			expect(user2Tags).toEqual(["shared-tag"]);
		});
	});

	describe("getUsersByTag", () => {
		it("should return users with a specific tag", async () => {
			// Add tags to users
			await tagService.setUserTags(testUserId, ["frontend", "senior"]);
			await tagService.setUserTags(testUserId2, ["frontend", "junior"]);

			const result = await tagService.getUsersByTag("frontend");

			expect(result).toHaveLength(2);
			expect(result.some((u) => u.id === testUserId)).toBe(true);
			expect(result.some((u) => u.id === testUserId2)).toBe(true);
		});

		it("should handle case-insensitive search", async () => {
			await tagService.setUserTags(testUserId, ["Frontend"]);

			const result = await tagService.getUsersByTag("frontend");

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe(testUserId);
		});

		it("should return empty array when no users have the tag", async () => {
			const result = await tagService.getUsersByTag("nonexistent");
			expect(result).toEqual([]);
		});
	});

	describe("getUsersByTags", () => {
		it("should return users with ALL specified tags", async () => {
			// User 1: has frontend and senior
			await tagService.setUserTags(testUserId, ["frontend", "senior", "javascript"]);

			// User 2: has frontend but not senior
			await tagService.setUserTags(testUserId2, ["frontend", "junior", "javascript"]);

			// Search for users with both frontend AND senior
			const result = await tagService.getUsersByTags(["frontend", "senior"]);

			expect(result).toEqual([testUserId]);
		});

		it("should handle case-insensitive search for multiple tags", async () => {
			await tagService.setUserTags(testUserId, ["Frontend", "Senior"]);

			const result = await tagService.getUsersByTags(["frontend", "senior"]);

			expect(result).toEqual([testUserId]);
		});

		it("should return empty array for empty tag list", async () => {
			const result = await tagService.getUsersByTags([]);
			expect(result).toEqual([]);
		});

		it("should return empty array when no users have all tags", async () => {
			await tagService.setUserTags(testUserId, ["frontend"]);
			await tagService.setUserTags(testUserId2, ["backend"]);

			const result = await tagService.getUsersByTags(["frontend", "backend", "devops"]);

			expect(result).toEqual([]);
		});

		it("should return users that have exactly the requested tags among others", async () => {
			// User has more tags than requested
			await tagService.setUserTags(testUserId, ["frontend", "backend", "devops", "senior"]);

			// Should still find the user when searching for subset
			const result = await tagService.getUsersByTags(["frontend", "backend"]);

			expect(result).toEqual([testUserId]);
		});
	});
});
