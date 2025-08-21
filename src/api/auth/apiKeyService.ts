import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { pino } from "pino";
import { db, users } from "@/db/index";

const logger = pino({ name: "ApiKeyService" });

export class ApiKeyService {
	private readonly SALT_ROUNDS = 12; // bcrypt salt rounds for security
	private readonly API_KEY_PREFIX = "ccs_";
	private readonly API_KEY_RANDOM_BYTES = 32; // 32 bytes = 64 hex chars
	private readonly API_KEY_EXPECTED_LENGTH = this.API_KEY_PREFIX.length + this.API_KEY_RANDOM_BYTES * 2; // prefix + hex chars

	/**
	 * Creates a new user with an API key
	 * Throws error if user already exists
	 * Returns the raw API key (to be shown once) and stores the hash in DB
	 */
	async createUserWithApiKey(username: string): Promise<string> {
		try {
			// Check if user already exists
			const [existingUser] = await db.select().from(users).where(eq(users.username, username));

			if (existingUser) {
				throw new Error(`User ${username} already exists`);
			}

			// Generate a secure random API key
			// Format: prefix + 32 random bytes as hex
			const randomBytes = crypto.randomBytes(this.API_KEY_RANDOM_BYTES);
			const apiKey = `${this.API_KEY_PREFIX}${randomBytes.toString("hex")}`;

			// Hash the API key using bcrypt
			const apiKeyHash = await bcrypt.hash(apiKey, this.SALT_ROUNDS);

			// Create new user with the hashed API key
			await db.insert(users).values({
				username,
				apiKeyHash,
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			logger.info(`Created new user with API key: ${username}`);

			// Return the raw API key (to be shown to user once)
			return apiKey;
		} catch (error) {
			if (error instanceof Error && error.message.includes("already exists")) {
				throw error;
			}
			logger.error(error, `Failed to create user with API key: ${username}`);
			throw new Error("Failed to create user with API key");
		}
	}

	/**
	 * Regenerates API key for an existing user
	 * Throws error if user doesn't exist
	 * Returns the raw API key (to be shown once) and stores the hash in DB
	 */
	async regenerateApiKey(username: string): Promise<string> {
		try {
			// Check if user exists
			const [existingUser] = await db.select().from(users).where(eq(users.username, username));

			if (!existingUser) {
				throw new Error(`User ${username} not found`);
			}

			// Generate a secure random API key
			// Format: prefix + 32 random bytes as hex
			const randomBytes = crypto.randomBytes(this.API_KEY_RANDOM_BYTES);
			const apiKey = `${this.API_KEY_PREFIX}${randomBytes.toString("hex")}`;

			// Hash the API key using bcrypt
			const apiKeyHash = await bcrypt.hash(apiKey, this.SALT_ROUNDS);

			// Update existing user with the new hashed API key
			await db
				.update(users)
				.set({
					apiKeyHash,
					updatedAt: new Date(),
				})
				.where(eq(users.username, username));

			logger.info(`Regenerated API key for user: ${username}`);

			// Return the raw API key (to be shown to user once)
			return apiKey;
		} catch (error) {
			if (error instanceof Error && error.message.includes("not found")) {
				throw error;
			}
			logger.error(error, `Failed to regenerate API key for user: ${username}`);
			throw new Error("Failed to regenerate API key");
		}
	}

	/**
	 * Validates an API key for a given username
	 * Returns true if the API key is valid for the user
	 */
	async validateApiKey(username: string, apiKey: string): Promise<boolean> {
		try {
			// Check API key format
			// Format: prefix + 64 hex chars
			if (!apiKey || !apiKey.startsWith(this.API_KEY_PREFIX) || apiKey.length !== this.API_KEY_EXPECTED_LENGTH) {
				return false;
			}

			// Get user's API key hash from database
			const [user] = await db.select().from(users).where(eq(users.username, username));

			if (!user || !user.apiKeyHash) {
				return false;
			}

			// Compare the provided API key with the stored hash
			const isValid = await bcrypt.compare(apiKey, user.apiKeyHash);

			if (!isValid) {
				logger.warn(`Invalid API key attempt for user: ${username}`);
			}

			return isValid;
		} catch (error) {
			logger.error(error, `Failed to validate API key for user: ${username}`);
			return false;
		}
	}

	/**
	 * Revokes a user's API key by removing it from the database
	 */
	async revokeApiKey(username: string): Promise<void> {
		try {
			await db
				.update(users)
				.set({
					apiKeyHash: null,
					updatedAt: new Date(),
				})
				.where(eq(users.username, username));

			logger.info(`Revoked API key for user: ${username}`);
		} catch (error) {
			logger.error(error, `Failed to revoke API key for user: ${username}`);
			throw new Error("Failed to revoke API key");
		}
	}

	/**
	 * Checks if a user has an API key set
	 */
	async hasApiKey(username: string): Promise<boolean> {
		try {
			const [user] = await db.select({ apiKeyHash: users.apiKeyHash }).from(users).where(eq(users.username, username));

			return !!user?.apiKeyHash;
		} catch (error) {
			logger.error(error, `Failed to check API key existence for user: ${username}`);
			return false;
		}
	}
}
