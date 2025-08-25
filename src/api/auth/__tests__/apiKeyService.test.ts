import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, tags, users } from "@/db/index";
import { cleanupTestDatabase } from "@/test-utils/cleanupTestDatabase";
import { ApiKeyService } from "../apiKeyService";

describe("ApiKeyService", () => {
	let apiKeyService: ApiKeyService;
	const timestamp = Date.now();
	const testUsernamePrefix = `test-apikey-${timestamp}-`;

	beforeAll(async () => {
		// Clean database before starting tests
		await cleanupTestDatabase();
	});

	beforeEach(() => {
		apiKeyService = new ApiKeyService();
	});

	afterAll(async () => {
		// Final cleanup after all tests
		await cleanupTestDatabase();
	});

	// Helper function to get user tags from database
	async function getUserTags(userId: number): Promise<string[]> {
		const userTags = await db.select().from(tags).where(eq(tags.userId, userId));
		return userTags.map((tag) => tag.name).sort();
	}

	describe("API Key Format and Hashing", () => {
		it("should generate API key with correct format", async () => {
			const testUsername = `${testUsernamePrefix}format`;

			const apiKey = await apiKeyService.createUserWithApiKey(testUsername);

			// Check API key format
			expect(apiKey).toMatch(/^ccs_[a-f0-9]{64}$/);
			expect(apiKey.length).toBe(68); // "ccs_" (4) + 64 hex chars

			// Verify user was created in database
			const [createdUser] = await db.select().from(users).where(eq(users.username, testUsername));
			expect(createdUser).toBeDefined();
			expect(createdUser.username).toBe(testUsername);
			expect(createdUser.apiKeyHash).toBeDefined();
		});

		it("should properly hash and verify API key", async () => {
			// Test the bcrypt hashing directly
			const testApiKey = `ccs_${"a".repeat(64)}`;
			const hash = await bcrypt.hash(testApiKey, 12);

			// Verify the hash format
			expect(hash).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);

			// Test verification
			const isValid = await bcrypt.compare(testApiKey, hash);
			expect(isValid).toBe(true);

			// Test with wrong key
			const wrongKey = `ccs_${"b".repeat(64)}`;
			const isInvalid = await bcrypt.compare(wrongKey, hash);
			expect(isInvalid).toBe(false);
		});

		it("should validate API key with correct format check", async () => {
			const testUsername = `${testUsernamePrefix}validate`;

			// Create user with API key
			const apiKey = await apiKeyService.createUserWithApiKey(testUsername);

			// Test validation with correct key
			const isValid = await apiKeyService.validateApiKey(testUsername, apiKey);
			expect(isValid).toBe(true);

			// Test with wrong key
			const wrongKey = `ccs_${"b".repeat(64)}`;
			const isInvalid = await apiKeyService.validateApiKey(testUsername, wrongKey);
			expect(isInvalid).toBe(false);
		});

		it("should reject API key with invalid format", async () => {
			const testUsername = `${testUsernamePrefix}invalid-format`;

			// Create a user first
			await apiKeyService.createUserWithApiKey(testUsername);

			// Test various invalid formats
			const invalidKeys = [
				"invalid_key",
				"ccs_short",
				`CCS_${"a".repeat(64)}`, // Wrong case
				`ccs_${"a".repeat(63)}`, // Too short (67 chars total)
				`ccs_${"a".repeat(65)}`, // Too long (69 chars total)
				`api_${"a".repeat(64)}`, // Wrong prefix
				"", // Empty
			];

			for (const invalidKey of invalidKeys) {
				const isValid = await apiKeyService.validateApiKey(testUsername, invalidKey);
				expect(isValid).toBe(false);
			}
		});
	});

	describe("createUserWithApiKey", () => {
		it("should create new user when user doesn't exist", async () => {
			const testUsername = `${testUsernamePrefix}newuser`;

			const apiKey = await apiKeyService.createUserWithApiKey(testUsername);

			expect(apiKey).toMatch(/^ccs_[a-f0-9]{64}$/);

			// Verify user was created in database
			const [createdUser] = await db.select().from(users).where(eq(users.username, testUsername));
			expect(createdUser).toBeDefined();
			expect(createdUser.username).toBe(testUsername);
			expect(createdUser.apiKeyHash).toBeDefined();

			// Verify no tags were created
			const tagNames = await getUserTags(createdUser.id);
			expect(tagNames).toEqual([]);
		});

		it("should create new user with tags", async () => {
			const testUsername = `${testUsernamePrefix}with-tags`;
			const testTags = ["frontend", "react", "typescript"];

			const apiKey = await apiKeyService.createUserWithApiKey(testUsername, testTags);

			expect(apiKey).toMatch(/^ccs_[a-f0-9]{64}$/);

			// Verify user was created
			const [createdUser] = await db.select().from(users).where(eq(users.username, testUsername));
			expect(createdUser).toBeDefined();
			expect(createdUser.username).toBe(testUsername);

			// Verify tags were created
			const tagNames = await getUserTags(createdUser.id);
			expect(tagNames).toEqual(testTags.sort());
		});

		it("should throw error when user already exists", async () => {
			const testUsername = `${testUsernamePrefix}duplicate`;

			// Create user first
			await apiKeyService.createUserWithApiKey(testUsername);

			// Try to create same user again
			await expect(apiKeyService.createUserWithApiKey(testUsername)).rejects.toThrow(
				`User ${testUsername} already exists`,
			);
		});
	});

	describe("regenerateApiKey", () => {
		it("should regenerate API key for existing user", async () => {
			const testUsername = `${testUsernamePrefix}regenerate`;

			// Create user first
			const originalApiKey = await apiKeyService.createUserWithApiKey(testUsername);

			// Get original hash
			const [userBefore] = await db.select().from(users).where(eq(users.username, testUsername));
			const originalHash = userBefore.apiKeyHash;

			// Regenerate API key
			const newApiKey = await apiKeyService.regenerateApiKey(testUsername);

			expect(newApiKey).toMatch(/^ccs_[a-f0-9]{64}$/);
			expect(newApiKey).not.toBe(originalApiKey);

			// Verify hash was updated
			const [userAfter] = await db.select().from(users).where(eq(users.username, testUsername));
			expect(userAfter.apiKeyHash).not.toBe(originalHash);

			// Verify old key no longer works
			const oldKeyValid = await apiKeyService.validateApiKey(testUsername, originalApiKey);
			expect(oldKeyValid).toBe(false);

			// Verify new key works
			const newKeyValid = await apiKeyService.validateApiKey(testUsername, newApiKey);
			expect(newKeyValid).toBe(true);
		});

		it("should throw error when user doesn't exist", async () => {
			const testUsername = `${testUsernamePrefix}nonexistent`;

			await expect(apiKeyService.regenerateApiKey(testUsername)).rejects.toThrow(`User ${testUsername} not found`);
		});
	});

	describe("validateApiKey", () => {
		it("should return true for valid API key", async () => {
			const testUsername = `${testUsernamePrefix}valid-key`;

			// Create user with API key
			const apiKey = await apiKeyService.createUserWithApiKey(testUsername);

			// Validate the correct key
			const isValid = await apiKeyService.validateApiKey(testUsername, apiKey);
			expect(isValid).toBe(true);
		});

		it("should return false for wrong API key", async () => {
			const testUsername = `${testUsernamePrefix}wrong-key`;

			// Create user with API key
			await apiKeyService.createUserWithApiKey(testUsername);

			// Try with wrong key
			const wrongKey = `ccs_${"b".repeat(64)}`;
			const isValid = await apiKeyService.validateApiKey(testUsername, wrongKey);
			expect(isValid).toBe(false);
		});

		it("should return false when user doesn't exist", async () => {
			const testUsername = `${testUsernamePrefix}no-user`;
			const apiKey = `ccs_${"a".repeat(64)}`;

			const isValid = await apiKeyService.validateApiKey(testUsername, apiKey);
			expect(isValid).toBe(false);
		});

		it("should return false when user has no API key", async () => {
			const testUsername = `${testUsernamePrefix}no-key`;

			// Create user directly without API key
			await db.insert(users).values({
				username: testUsername,
				apiKeyHash: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			const apiKey = `ccs_${"a".repeat(64)}`;
			const isValid = await apiKeyService.validateApiKey(testUsername, apiKey);
			expect(isValid).toBe(false);
		});
	});

	describe("Integration test - full flow", () => {
		it("should generate and validate the same API key", async () => {
			const testUsername = `${testUsernamePrefix}integration`;

			// Generate API key
			const apiKey = await apiKeyService.createUserWithApiKey(testUsername);
			expect(apiKey).toMatch(/^ccs_[a-f0-9]{64}$/);

			// Validate the same API key
			const isValid = await apiKeyService.validateApiKey(testUsername, apiKey);
			expect(isValid).toBe(true);

			// Validate with wrong key should fail
			const wrongKey = `ccs_${"b".repeat(64)}`;
			const isInvalid = await apiKeyService.validateApiKey(testUsername, wrongKey);
			expect(isInvalid).toBe(false);
		});

		it("should handle complete user lifecycle with tags", async () => {
			const testUsername = `${testUsernamePrefix}lifecycle`;
			const initialTags = ["backend", "nodejs"];

			// Create user with tags
			const apiKey1 = await apiKeyService.createUserWithApiKey(testUsername, initialTags);
			expect(apiKey1).toMatch(/^ccs_[a-f0-9]{64}$/);

			// Verify user has tags
			const [user1] = await db.select().from(users).where(eq(users.username, testUsername));
			const tagNames1 = await getUserTags(user1.id);
			expect(tagNames1).toEqual(initialTags.sort());

			// Validate API key works
			const isValid1 = await apiKeyService.validateApiKey(testUsername, apiKey1);
			expect(isValid1).toBe(true);

			// Regenerate API key
			const apiKey2 = await apiKeyService.regenerateApiKey(testUsername);
			expect(apiKey2).not.toBe(apiKey1);

			// Old key should not work
			const oldKeyValid = await apiKeyService.validateApiKey(testUsername, apiKey1);
			expect(oldKeyValid).toBe(false);

			// New key should work
			const newKeyValid = await apiKeyService.validateApiKey(testUsername, apiKey2);
			expect(newKeyValid).toBe(true);

			// Tags should be preserved after regeneration
			const [user2] = await db.select().from(users).where(eq(users.username, testUsername));
			const tagNames2 = await getUserTags(user2.id);
			expect(tagNames2).toEqual(initialTags.sort());
		});
	});
});
