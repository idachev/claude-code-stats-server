import bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, users } from "@/db/index";
import { ApiKeyService } from "../apiKeyService";

// Mock the database
vi.mock("@/db/index", () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
	},
	users: {
		username: "username",
		apiKeyHash: "apiKeyHash",
	},
}));

// Mock pino logger
vi.mock("pino", () => ({
	pino: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	}),
}));

describe("ApiKeyService", () => {
	let apiKeyService: ApiKeyService;

	beforeEach(() => {
		apiKeyService = new ApiKeyService();
		vi.clearAllMocks();
	});

	describe("API Key Format and Hashing", () => {
		it("should generate API key with correct format", async () => {
			// Mock database to simulate new user
			const mockSelect = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([]),
				}),
			});
			const mockInsert = vi.fn().mockReturnValue({
				values: vi.fn().mockResolvedValue(undefined),
			});
			(db.select as any).mockImplementation(mockSelect);
			(db.insert as any).mockImplementation(mockInsert);

			const apiKey = await apiKeyService.createUserWithApiKey("testuser");

			// Check API key format
			expect(apiKey).toMatch(/^ccs_[a-f0-9]{64}$/);
			expect(apiKey.length).toBe(68); // "ccs_" (4) + 64 hex chars
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
			const validKey = `ccs_${"a".repeat(64)}`;
			const hash = await bcrypt.hash(validKey, 12);

			// Mock database to return user with hash
			const mockSelect = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([
						{
							username: "testuser",
							apiKeyHash: hash,
						},
					]),
				}),
			});
			(db.select as any).mockImplementation(mockSelect);

			// Test validation
			const isValid = await apiKeyService.validateApiKey("testuser", validKey);
			expect(isValid).toBe(true);
		});

		it("should reject API key with invalid format", async () => {
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
				const isValid = await apiKeyService.validateApiKey("testuser", invalidKey);
				expect(isValid).toBe(false);
			}
		});
	});

	describe("createUserWithApiKey", () => {
		it("should create new user when user doesn't exist", async () => {
			// Mock database - user doesn't exist
			const mockSelect = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([]),
				}),
			});
			const mockInsert = vi.fn().mockReturnValue({
				values: vi.fn().mockResolvedValue(undefined),
			});
			(db.select as any).mockImplementation(mockSelect);
			(db.insert as any).mockImplementation(mockInsert);

			const apiKey = await apiKeyService.createUserWithApiKey("newuser");

			expect(apiKey).toMatch(/^ccs_[a-f0-9]{64}$/);
			expect(mockInsert).toHaveBeenCalledWith(users);
			expect(mockInsert().values).toHaveBeenCalledWith(
				expect.objectContaining({
					username: "newuser",
					apiKeyHash: expect.any(String),
				}),
			);
		});

		it("should throw error when user already exists", async () => {
			// Mock database - user exists
			const mockSelect = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([
						{
							username: "existinguser",
							apiKeyHash: "old_hash",
						},
					]),
				}),
			});
			const mockUpdate = vi.fn().mockReturnValue({
				set: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue(undefined),
				}),
			});
			(db.select as any).mockImplementation(mockSelect);
			(db.update as any).mockImplementation(mockUpdate);

			await expect(apiKeyService.createUserWithApiKey("existinguser")).rejects.toThrow(
				"User existinguser already exists",
			);

			expect(mockUpdate).not.toHaveBeenCalled();
		});
	});

	describe("regenerateApiKey", () => {
		it("should regenerate API key for existing user", async () => {
			// Mock database - user exists
			const mockSelect = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([
						{
							username: "existinguser",
							apiKeyHash: "old_hash",
						},
					]),
				}),
			});
			const mockUpdate = vi.fn().mockReturnValue({
				set: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue(undefined),
				}),
			});
			(db.select as any).mockImplementation(mockSelect);
			(db.update as any).mockImplementation(mockUpdate);

			const apiKey = await apiKeyService.regenerateApiKey("existinguser");

			expect(apiKey).toMatch(/^ccs_[a-f0-9]{64}$/);
			expect(mockUpdate).toHaveBeenCalledWith(users);
		});

		it("should throw error when user doesn't exist", async () => {
			// Mock database - user doesn't exist
			const mockSelect = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([]),
				}),
			});
			(db.select as any).mockImplementation(mockSelect);

			await expect(apiKeyService.regenerateApiKey("nonexistent")).rejects.toThrow("User nonexistent not found");
		});
	});

	describe("validateApiKey", () => {
		it("should return true for valid API key", async () => {
			const apiKey = `ccs_${"a".repeat(64)}`;
			const hash = await bcrypt.hash(apiKey, 12);

			// Mock database
			const mockSelect = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([
						{
							username: "testuser",
							apiKeyHash: hash,
						},
					]),
				}),
			});
			(db.select as any).mockImplementation(mockSelect);

			const isValid = await apiKeyService.validateApiKey("testuser", apiKey);
			expect(isValid).toBe(true);
		});

		it("should return false for wrong API key", async () => {
			const correctKey = `ccs_${"a".repeat(64)}`;
			const wrongKey = `ccs_${"b".repeat(64)}`;
			const hash = await bcrypt.hash(correctKey, 12);

			// Mock database
			const mockSelect = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([
						{
							username: "testuser",
							apiKeyHash: hash,
						},
					]),
				}),
			});
			(db.select as any).mockImplementation(mockSelect);

			const isValid = await apiKeyService.validateApiKey("testuser", wrongKey);
			expect(isValid).toBe(false);
		});

		it("should return false when user doesn't exist", async () => {
			// Mock database - no user found
			const mockSelect = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([]),
				}),
			});
			(db.select as any).mockImplementation(mockSelect);

			const apiKey = `ccs_${"a".repeat(64)}`;
			const isValid = await apiKeyService.validateApiKey("nonexistent", apiKey);
			expect(isValid).toBe(false);
		});

		it("should return false when user has no API key", async () => {
			// Mock database - user exists but no API key
			const mockSelect = vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([
						{
							username: "testuser",
							apiKeyHash: null,
						},
					]),
				}),
			});
			(db.select as any).mockImplementation(mockSelect);

			const apiKey = `ccs_${"a".repeat(64)}`;
			const isValid = await apiKeyService.validateApiKey("testuser", apiKey);
			expect(isValid).toBe(false);
		});
	});

	describe("Integration test - full flow", () => {
		it("should generate and validate the same API key", async () => {
			let storedHash: string | null = null;

			// Mock database for generation
			const mockSelect = vi.fn().mockImplementation(() => ({
				from: () => ({
					where: async () => {
						if (storedHash) {
							return [{ username: "testuser", apiKeyHash: storedHash }];
						}
						return [];
					},
				}),
			}));

			const mockInsert = vi.fn().mockImplementation(() => ({
				values: async (data: any) => {
					storedHash = data.apiKeyHash;
				},
			}));

			(db.select as any).mockImplementation(mockSelect);
			(db.insert as any).mockImplementation(mockInsert);

			// Generate API key
			const apiKey = await apiKeyService.createUserWithApiKey("testuser");
			expect(apiKey).toMatch(/^ccs_[a-f0-9]{64}$/);
			expect(storedHash).toBeTruthy();

			// Now validate the same API key
			const isValid = await apiKeyService.validateApiKey("testuser", apiKey);
			expect(isValid).toBe(true);

			// Validate with wrong key should fail
			const wrongKey = `ccs_${"b".repeat(64)}`;
			const isInvalid = await apiKeyService.validateApiKey("testuser", wrongKey);
			expect(isInvalid).toBe(false);
		});
	});
});
