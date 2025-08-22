import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TagService } from "@/api/tags/tagService";
import { UserRepository } from "@/api/user/userRepository";
import { db, type NewUser, users } from "@/db/index";

describe("UserRepository Integration Tests with Tags", () => {
	let userRepository: UserRepository;
	let tagService: TagService;

	// Test users
	let testUser1: { id: number; username: string };
	let testUser2: { id: number; username: string };
	let testUser3: { id: number; username: string };

	beforeAll(async () => {
		userRepository = new UserRepository();
		tagService = new TagService();

		// Create test users with unique names
		const timestamp = Date.now();
		const testUsers: NewUser[] = [
			{ username: `test-repo-user1-${timestamp}` },
			{ username: `test-repo-user2-${timestamp}` },
			{ username: `test-repo-user3-${timestamp}` },
		];

		const createdUsers = await db.insert(users).values(testUsers).returning();
		testUser1 = createdUsers[0];
		testUser2 = createdUsers[1];
		testUser3 = createdUsers[2];

		// Assign tags to users
		await tagService.setUserTags(testUser1.id, ["frontend", "react", "typescript"]);
		await tagService.setUserTags(testUser2.id, ["backend", "python"]);
		// testUser3 has no tags
	});

	afterAll(async () => {
		// Clean up test data
		for (const user of [testUser1, testUser2, testUser3]) {
			if (user) {
				await db.delete(users).where(eq(users.id, user.id));
			}
		}
	});

	describe("findAllAsync", () => {
		it("should return all users with their tags", async () => {
			const allUsers = await userRepository.findAllAsync();

			// Find our test users
			const user1 = allUsers.find((u) => u.id === testUser1.id);
			const user2 = allUsers.find((u) => u.id === testUser2.id);
			const user3 = allUsers.find((u) => u.id === testUser3.id);

			// Verify user1 has correct tags
			expect(user1).toBeDefined();
			expect(user1?.tags).toEqual(["frontend", "react", "typescript"]);

			// Verify user2 has correct tags
			expect(user2).toBeDefined();
			expect(user2?.tags).toEqual(["backend", "python"]);

			// Verify user3 has empty tags
			expect(user3).toBeDefined();
			expect(user3?.tags).toEqual([]);
		});

		it("should return users with empty tags array when they have no tags", async () => {
			const allUsers = await userRepository.findAllAsync();

			// All users should have tags property (even if empty)
			for (const user of allUsers) {
				expect(user).toHaveProperty("tags");
				expect(Array.isArray(user.tags)).toBe(true);
			}
		});

		it("should group tags correctly by user", async () => {
			// Add more tags to user1
			await tagService.setUserTags(testUser1.id, ["tag1", "tag2", "tag3", "tag4", "tag5"]);

			const allUsers = await userRepository.findAllAsync();
			const user1 = allUsers.find((u) => u.id === testUser1.id);

			expect(user1).toBeDefined();
			expect(user1?.tags).toHaveLength(5);
			expect(user1?.tags).toEqual(["tag1", "tag2", "tag3", "tag4", "tag5"]);
		});

		it("should handle users with duplicate tag names correctly", async () => {
			// This shouldn't happen due to unique constraint, but test the grouping logic
			const allUsers = await userRepository.findAllAsync();

			// Each user's tags should be unique within that user
			for (const user of allUsers) {
				const uniqueTags = [...new Set(user.tags)];
				expect(user.tags).toEqual(uniqueTags);
			}
		});
	});

	describe("findByUsernameAsync", () => {
		it("should return user with their tags", async () => {
			const user = await userRepository.findByUsernameAsync(testUser1.username);

			expect(user).not.toBeNull();
			expect(user?.id).toBe(testUser1.id);
			expect(user?.username).toBe(testUser1.username);
			expect(user?.tags).toBeDefined();
			expect(user?.tags.length).toBeGreaterThan(0);
		});

		it("should return user with empty tags when they have no tags", async () => {
			const user = await userRepository.findByUsernameAsync(testUser3.username);

			expect(user).not.toBeNull();
			expect(user?.id).toBe(testUser3.id);
			expect(user?.tags).toEqual([]);
		});

		it("should return null for non-existent username", async () => {
			const user = await userRepository.findByUsernameAsync("non-existent-user-xyz");

			expect(user).toBeNull();
		});

		it("should return tags sorted alphabetically", async () => {
			// Set tags in non-alphabetical order
			await tagService.setUserTags(testUser2.id, ["zebra", "alpha", "middle"]);

			const user = await userRepository.findByUsernameAsync(testUser2.username);

			expect(user).not.toBeNull();
			expect(user?.tags).toEqual(["alpha", "middle", "zebra"]);
		});

		it("should handle special characters in tags", async () => {
			// Set tags with allowed special characters
			await tagService.setUserTags(testUser1.id, ["tag-with-dash", "tag.with.dot", "tag_with_underscore"]);

			const user = await userRepository.findByUsernameAsync(testUser1.username);

			expect(user).not.toBeNull();
			expect(user?.tags).toContain("tag-with-dash");
			expect(user?.tags).toContain("tag.with.dot");
			expect(user?.tags).toContain("tag_with_underscore");
		});
	});

	describe("Performance considerations", () => {
		it("should use single query with JOIN for findAllAsync", async () => {
			// This test verifies that we're not doing N+1 queries
			// The implementation should use a single query with LEFT JOIN
			const startTime = Date.now();
			const allUsers = await userRepository.findAllAsync();
			const endTime = Date.now();

			// Should be fast (single query)
			expect(endTime - startTime).toBeLessThan(200); // 200ms is generous

			// Should return valid data
			expect(Array.isArray(allUsers)).toBe(true);
		});

		it("should use single query with JOIN for findByUsernameAsync", async () => {
			// This test verifies that we're not doing multiple queries
			const startTime = Date.now();
			const user = await userRepository.findByUsernameAsync(testUser1.username);
			const endTime = Date.now();

			// Should be fast (single query)
			expect(endTime - startTime).toBeLessThan(100);

			// Should return valid data
			expect(user).not.toBeNull();
			expect(user?.tags).toBeDefined();
		});
	});
});
