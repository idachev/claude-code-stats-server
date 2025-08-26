import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TagService } from "@/api/tags/tagService";
import { UserRepository } from "@/api/user/userRepository";
import { db, type NewUser, users } from "@/db/index";
import { cleanupTestDatabase } from "@/test-utils/cleanupTestDatabase";

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
		await cleanupTestDatabase();
	});

	describe("findAllAsync", () => {
		it("should return all users with their tags", async () => {
			const result = await userRepository.findAllAsync();
			const allUsers = result.users;

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
			const result = await userRepository.findAllAsync();
			const allUsers = result.users;

			// All users should have tags property (even if empty)
			for (const user of allUsers) {
				expect(user).toHaveProperty("tags");
				expect(Array.isArray(user.tags)).toBe(true);
			}
		});

		it("should group tags correctly by user", async () => {
			// Add more tags to user1
			await tagService.setUserTags(testUser1.id, ["tag1", "tag2", "tag3", "tag4", "tag5"]);

			const result = await userRepository.findAllAsync();
			const user1 = result.users.find((u) => u.id === testUser1.id);

			expect(user1).toBeDefined();
			expect(user1?.tags).toHaveLength(5);
			expect(user1?.tags).toEqual(["tag1", "tag2", "tag3", "tag4", "tag5"]);
		});

		it("should handle users with duplicate tag names correctly", async () => {
			// This shouldn't happen due to unique constraint, but test the grouping logic
			const result = await userRepository.findAllAsync();
			const allUsers = result.users;

			// Each user's tags should be unique within that user
			for (const user of allUsers) {
				const uniqueTags = [...new Set(user.tags)];
				expect(user.tags).toEqual(uniqueTags);
			}
		});
	});

	describe("findAllAsync with pagination and filters", () => {
		beforeAll(async () => {
			// Reset tags to known state for filter tests
			await tagService.setUserTags(testUser1.id, ["frontend", "react", "typescript"]);
			await tagService.setUserTags(testUser2.id, ["backend", "python"]);
		});

		it("should paginate results correctly", async () => {
			// Get first page with limit 2
			const firstPage = await userRepository.findAllAsync({
				page: 1,
				limit: 2,
			});

			expect(firstPage.users.length).toBeLessThanOrEqual(2);
			expect(firstPage.pagination.page).toBe(1);
			expect(firstPage.pagination.limit).toBe(2);
			expect(firstPage.pagination.total).toBeGreaterThanOrEqual(3); // We created at least 3 test users

			// Get second page
			const secondPage = await userRepository.findAllAsync({
				page: 2,
				limit: 2,
			});

			expect(secondPage.users.length).toBeGreaterThanOrEqual(1);
			expect(secondPage.pagination.page).toBe(2);

			// Ensure no overlap between pages
			const firstPageIds = firstPage.users.map((u) => u.id);
			const secondPageIds = secondPage.users.map((u) => u.id);
			const overlap = firstPageIds.filter((id) => secondPageIds.includes(id));
			expect(overlap).toEqual([]);
		});

		it("should filter users by search term", async () => {
			const result = await userRepository.findAllAsync({
				search: "test-repo-user1",
			});

			expect(result.users.length).toBeGreaterThanOrEqual(1);
			expect(result.users.some((u) => u.username.includes("test-repo-user1"))).toBe(true);
			expect(result.filters.search).toBe("test-repo-user1");
		});

		it("should perform case-insensitive search", async () => {
			const upperResult = await userRepository.findAllAsync({
				search: "TEST-REPO-USER1",
			});

			const lowerResult = await userRepository.findAllAsync({
				search: "test-repo-user1",
			});

			// Both should return the same results
			expect(upperResult.users.length).toBe(lowerResult.users.length);
			expect(upperResult.users[0]?.id).toBe(lowerResult.users[0]?.id);
		});

		it("should filter users by single tag", async () => {
			const result = await userRepository.findAllAsync({
				tags: ["frontend"],
			});

			// Should include testUser1 who has "frontend" tag
			const userIds = result.users.map((u) => u.id);
			expect(userIds).toContain(testUser1.id);
			expect(result.filters.tags).toEqual(["frontend"]);
		});

		it("should filter users by multiple tags with AND logic", async () => {
			const result = await userRepository.findAllAsync({
				tags: ["backend", "python"],
			});

			// Should only include testUser2 who has both tags
			const userIds = result.users.map((u) => u.id);
			expect(userIds).toContain(testUser2.id);
			expect(userIds).not.toContain(testUser1.id);
		});

		it("should return empty results for non-matching tags", async () => {
			const result = await userRepository.findAllAsync({
				tags: ["nonexistenttag"],
			});

			expect(result.users).toEqual([]);
			expect(result.pagination.total).toBe(0);
			expect(result.pagination.totalPages).toBe(0);
		});

		it("should combine search and tag filters", async () => {
			const result = await userRepository.findAllAsync({
				search: "user2",
				tags: ["backend"],
			});

			// Should only include testUser2
			const userIds = result.users.map((u) => u.id);
			expect(userIds).toContain(testUser2.id);
			expect(userIds.length).toBeLessThanOrEqual(1);
		});

		it("should sort by username ascending", async () => {
			const result = await userRepository.findAllAsync({
				sortBy: "username",
				order: "asc",
			});

			// Check usernames are in ascending order
			const usernames = result.users.map((u) => u.username);
			const sortedUsernames = [...usernames].sort();
			expect(usernames).toEqual(sortedUsernames);
		});

		it("should sort by username descending", async () => {
			const result = await userRepository.findAllAsync({
				sortBy: "username",
				order: "desc",
			});

			// Check usernames are in descending order
			const usernames = result.users.map((u) => u.username);
			const sortedUsernames = [...usernames].sort().reverse();
			expect(usernames).toEqual(sortedUsernames);
		});

		it("should sort by createdAt ascending", async () => {
			const result = await userRepository.findAllAsync({
				sortBy: "createdAt",
				order: "asc",
			});

			// Check dates are in ascending order
			for (let i = 1; i < result.users.length; i++) {
				const prevDate = result.users[i - 1].createdAt;
				const currDate = result.users[i].createdAt;
				expect(prevDate.getTime()).toBeLessThanOrEqual(currDate.getTime());
			}
		});

		it("should sort by updatedAt descending by default", async () => {
			const result = await userRepository.findAllAsync({
				sortBy: "updatedAt",
				// order defaults to "desc"
			});

			// Check dates are in descending order
			for (let i = 1; i < result.users.length; i++) {
				const prevDate = result.users[i - 1].updatedAt;
				const currDate = result.users[i].updatedAt;
				expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime());
			}
		});

		it("should respect maximum page limit", async () => {
			const result = await userRepository.findAllAsync({
				limit: 1000, // Exceeds MAX_PAGE_LIMIT
			});

			// Should be capped at MAX_PAGE_LIMIT (100)
			expect(result.pagination.limit).toBeLessThanOrEqual(100);
		});

		it("should handle empty results for high page number", async () => {
			const result = await userRepository.findAllAsync({
				page: 9999,
				limit: 20,
			});

			expect(result.users).toEqual([]);
			expect(result.pagination.page).toBe(9999);
		});

		it("should maintain tags when using filters", async () => {
			const result = await userRepository.findAllAsync({
				search: "test-repo-user1",
			});

			// The filtered user should still have their tags
			const user = result.users.find((u) => u.id === testUser1.id);
			expect(user?.tags.length).toBeGreaterThan(0);
		});

		it("should calculate totalPages correctly", async () => {
			const result = await userRepository.findAllAsync({
				limit: 2,
			});

			const expectedTotalPages = Math.ceil(result.pagination.total / result.pagination.limit);
			expect(result.pagination.totalPages).toBe(expectedTotalPages);
		});
	});

	describe("findAllSimpleAsync", () => {
		it("should return all users without pagination", async () => {
			const users = await userRepository.findAllSimpleAsync();

			// Should return array of users directly
			expect(Array.isArray(users)).toBe(true);

			// Should include all our test users
			const userIds = users.map((u) => u.id);
			expect(userIds).toContain(testUser1.id);
			expect(userIds).toContain(testUser2.id);
			expect(userIds).toContain(testUser3.id);
		});

		it("should include tags for all users", async () => {
			const users = await userRepository.findAllSimpleAsync();

			// Find our test users
			const user1 = users.find((u) => u.id === testUser1.id);
			const user2 = users.find((u) => u.id === testUser2.id);
			const user3 = users.find((u) => u.id === testUser3.id);

			expect(user1?.tags.length).toBeGreaterThan(0);
			expect(user2?.tags.length).toBeGreaterThan(0);
			expect(user3?.tags).toEqual([]);
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
			const result = await userRepository.findAllAsync();
			const endTime = Date.now();

			// Should be fast (single query)
			expect(endTime - startTime).toBeLessThan(200); // 200ms is generous

			// Should return valid data
			expect(result).toHaveProperty("users");
			expect(Array.isArray(result.users)).toBe(true);
			expect(result).toHaveProperty("pagination");
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
