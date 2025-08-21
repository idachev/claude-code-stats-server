import { like } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { afterEach, beforeEach } from "vitest";

import type { User } from "@/api/user/userModel";
import type { ServiceResponse } from "@/common/models/serviceResponse";
import { db, users } from "@/db/index";
import { app } from "@/server";

describe("User API Endpoints", () => {
	const adminApiKey = process.env.ADMIN_API_KEY || "test-admin-key";

	// Clean up test users after each test
	afterEach(async () => {
		// Clean up any test users created during tests
		await db.delete(users).where(like(users.username, "test-%"));
	});

	describe("GET /admin/users", () => {
		it("should return 401 without admin API key", async () => {
			// Act
			const response = await request(app).get("/admin/users");

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
		});

		it("should return 401 with invalid admin API key", async () => {
			// Act
			const response = await request(app).get("/admin/users").set("X-Admin-Key", "invalid-key");

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
		});

		it("should return a list of users with valid admin API key", async () => {
			// Act
			const response = await request(app).get("/admin/users").set("X-Admin-Key", adminApiKey);
			const responseBody: ServiceResponse<User[]> = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.OK);
			expect(responseBody.success).toBeTruthy();
			expect(responseBody.message).toMatch(/users found/i);
			expect(Array.isArray(responseBody.responseObject)).toBeTruthy();
		});
	});

	describe("GET /admin/users/:username", () => {
		it("should return 401 without admin API key", async () => {
			// Act
			const response = await request(app).get("/admin/users/testuser");

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
		});

		it("should return 401 with invalid admin API key", async () => {
			// Act
			const response = await request(app).get("/admin/users/testuser").set("X-Admin-Key", "invalid-key");

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
		});

		it("should return a not found error for non-existent username with valid admin API key", async () => {
			// Arrange
			const testUsername = "nonexistentuser123456";

			// Act
			const response = await request(app).get(`/admin/users/${testUsername}`).set("X-Admin-Key", adminApiKey);
			const responseBody: ServiceResponse = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
			expect(responseBody.success).toBeFalsy();
			expect(responseBody.message).toContain("User not found");
			expect(responseBody.responseObject).toBeNull();
		});

		it("should return a bad request for invalid username format", async () => {
			// Act
			const invalidUsername = "a"; // too short
			const response = await request(app).get(`/admin/users/${invalidUsername}`).set("X-Admin-Key", adminApiKey);
			const responseBody: ServiceResponse = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
			expect(responseBody.success).toBeFalsy();
			expect(responseBody.message).toContain("Invalid input");
		});

		it("should return user details for existing username with valid admin API key", async () => {
			// Arrange - create a user first
			await request(app).post("/admin/users").set("X-Admin-Key", adminApiKey).send({ username: "test-getuser" });

			// Act
			const response = await request(app).get("/admin/users/test-getuser").set("X-Admin-Key", adminApiKey);
			const responseBody: ServiceResponse<User> = response.body;

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.OK);
			expect(responseBody.success).toBeTruthy();
			expect(responseBody.message).toContain("User found");
			expect(responseBody.responseObject).toBeDefined();
			expect(responseBody.responseObject?.username).toEqual("test-getuser");
			expect(responseBody.responseObject?.id).toBeDefined();
			expect(responseBody.responseObject?.createdAt).toBeDefined();
			expect(responseBody.responseObject?.updatedAt).toBeDefined();
		});
	});

	describe("POST /admin/users", () => {
		it("should return 401 without admin API key", async () => {
			// Act
			const response = await request(app).post("/admin/users").send({ username: "test-newuser" });

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
		});

		it("should return 401 with invalid admin API key", async () => {
			// Act
			const response = await request(app)
				.post("/admin/users")
				.set("X-Admin-Key", "invalid-key")
				.send({ username: "test-newuser" });

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
		});

		it("should create a new user with API key", async () => {
			// Act
			const response = await request(app)
				.post("/admin/users")
				.set("X-Admin-Key", adminApiKey)
				.send({ username: "test-newuser" });

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.CREATED);
			expect(response.body.username).toEqual("test-newuser");
			expect(response.body.apiKey).toMatch(/^ccs_[a-f0-9]{64}$/);
			expect(response.body.message).toContain("User created successfully");
		});

		it("should return 409 when creating duplicate user", async () => {
			// Arrange - create user first
			await request(app).post("/admin/users").set("X-Admin-Key", adminApiKey).send({ username: "test-duplicate" });

			// Act - try to create same user again
			const response = await request(app)
				.post("/admin/users")
				.set("X-Admin-Key", adminApiKey)
				.send({ username: "test-duplicate" });

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.CONFLICT);
			expect(response.body.error).toContain("already exists");
		});

		it("should return 400 for invalid username format", async () => {
			// Act
			const response = await request(app).post("/admin/users").set("X-Admin-Key", adminApiKey).send({ username: "a" }); // too short

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
			expect(response.body.success).toBe(false);
			expect(response.body.message).toContain("Invalid input");
		});

		it("should return 400 for missing username", async () => {
			// Act
			const response = await request(app).post("/admin/users").set("X-Admin-Key", adminApiKey).send({});

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
			expect(response.body.success).toBe(false);
			expect(response.body.message).toContain("Invalid input");
		});
	});

	describe("POST /admin/users/:username/api-key/regenerate", () => {
		it("should return 401 without admin API key", async () => {
			// Act
			const response = await request(app).post("/admin/users/test-user/api-key/regenerate");

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
		});

		it("should return 401 with invalid admin API key", async () => {
			// Act
			const response = await request(app)
				.post("/admin/users/test-user/api-key/regenerate")
				.set("X-Admin-Key", "invalid-key");

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
		});

		it("should regenerate API key for existing user", async () => {
			// Arrange - create user first
			const createResponse = await request(app)
				.post("/admin/users")
				.set("X-Admin-Key", adminApiKey)
				.send({ username: "test-regenerate" });
			const originalApiKey = createResponse.body.apiKey;

			// Act - regenerate API key
			const response = await request(app)
				.post("/admin/users/test-regenerate/api-key/regenerate")
				.set("X-Admin-Key", adminApiKey);

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.OK);
			expect(response.body.username).toEqual("test-regenerate");
			expect(response.body.apiKey).toMatch(/^ccs_[a-f0-9]{64}$/);
			expect(response.body.apiKey).not.toEqual(originalApiKey);
			expect(response.body.message).toContain("API key regenerated successfully");
		});

		it("should return 404 for non-existent user", async () => {
			// Act
			const response = await request(app)
				.post("/admin/users/test-nonexistent/api-key/regenerate")
				.set("X-Admin-Key", adminApiKey);

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
			expect(response.body.error).toContain("not found");
		});

		it("should return 400 for invalid username format", async () => {
			// Act
			const response = await request(app)
				.post("/admin/users/a/api-key/regenerate") // too short
				.set("X-Admin-Key", adminApiKey);

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
		});
	});

	describe("POST /admin/users/:username/api-key/check", () => {
		let testUsername: string;
		let validApiKey: string;

		beforeEach(async () => {
			// Create a test user with API key for validation tests
			testUsername = `test-validate-${Date.now()}`;
			const createResponse = await request(app)
				.post("/admin/users")
				.set("X-Admin-Key", adminApiKey)
				.send({ username: testUsername });
			validApiKey = createResponse.body.apiKey;
		});

		it("should return 401 without admin API key", async () => {
			// Act
			const response = await request(app)
				.post(`/admin/users/${testUsername}/api-key/check`)
				.send({ apiKey: validApiKey });

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
		});

		it("should return 401 with invalid admin API key", async () => {
			// Act
			const response = await request(app)
				.post(`/admin/users/${testUsername}/api-key/check`)
				.set("X-Admin-Key", "invalid-key")
				.send({ apiKey: validApiKey });

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
		});

		it("should validate correct API key", async () => {
			// Act
			const response = await request(app)
				.post(`/admin/users/${testUsername}/api-key/check`)
				.set("X-Admin-Key", adminApiKey)
				.send({ apiKey: validApiKey });

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.OK);
			expect(response.body.username).toEqual(testUsername);
			expect(response.body.isValid).toBe(true);
		});

		it("should reject incorrect API key", async () => {
			// Act
			const response = await request(app)
				.post(`/admin/users/${testUsername}/api-key/check`)
				.set("X-Admin-Key", adminApiKey)
				.send({ apiKey: "ccs_invalid_key_1234567890abcdef1234567890abcdef1234567890abcdef12345678" });

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.OK);
			expect(response.body.username).toEqual(testUsername);
			expect(response.body.isValid).toBe(false);
		});

		it("should reject old API key after regeneration", async () => {
			// Arrange - regenerate API key
			await request(app).post(`/admin/users/${testUsername}/api-key/regenerate`).set("X-Admin-Key", adminApiKey);

			// Act - check old API key
			const response = await request(app)
				.post(`/admin/users/${testUsername}/api-key/check`)
				.set("X-Admin-Key", adminApiKey)
				.send({ apiKey: validApiKey });

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.OK);
			expect(response.body.isValid).toBe(false);
		});

		it("should accept new API key after regeneration", async () => {
			// Arrange - regenerate API key
			const regenerateResponse = await request(app)
				.post(`/admin/users/${testUsername}/api-key/regenerate`)
				.set("X-Admin-Key", adminApiKey);
			const newApiKey = regenerateResponse.body.apiKey;

			// Act - check new API key
			const response = await request(app)
				.post(`/admin/users/${testUsername}/api-key/check`)
				.set("X-Admin-Key", adminApiKey)
				.send({ apiKey: newApiKey });

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.OK);
			expect(response.body.isValid).toBe(true);
		});

		it("should return 400 for missing API key", async () => {
			// Act
			const response = await request(app)
				.post(`/admin/users/${testUsername}/api-key/check`)
				.set("X-Admin-Key", adminApiKey)
				.send({});

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
			// Check for either validation error or controller error
			expect(response.body.message || response.body.error).toBeDefined();
		});

		it("should return 400 for invalid username format", async () => {
			// Act
			const response = await request(app)
				.post("/admin/users/a/api-key/check") // too short
				.set("X-Admin-Key", adminApiKey)
				.send({ apiKey: "some-key" });

			// Assert
			expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
		});
	});
});
