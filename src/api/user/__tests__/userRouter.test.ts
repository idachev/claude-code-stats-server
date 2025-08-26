import { like } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import request from "supertest";
import { afterEach, beforeEach } from "vitest";

import type { User } from "@/api/user/userModel";
import type { ErrorResponse } from "@/common/models/errorResponse";
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

    it("should return a paginated list of users with valid admin API key", async () => {
      // Act
      const response = await request(app).get("/admin/users").set("X-Admin-Key", adminApiKey);
      const responseBody = response.body;

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(responseBody).toHaveProperty("users");
      expect(Array.isArray(responseBody.users)).toBeTruthy();
      expect(responseBody).toHaveProperty("pagination");
      expect(responseBody.pagination).toHaveProperty("page", 1);
      expect(responseBody.pagination).toHaveProperty("limit", 20);
      expect(responseBody.pagination).toHaveProperty("total");
      expect(responseBody.pagination).toHaveProperty("totalPages");
      expect(responseBody).toHaveProperty("filters");
    });
  });

  describe("GET /admin/users with pagination and filtering", () => {
    beforeEach(async () => {
      // Create test users with different names and tags for filtering tests
      await request(app)
        .post("/admin/users")
        .set("X-Admin-Key", adminApiKey)
        .send({
          username: "test-alice-developer",
          tags: ["frontend", "react"],
        });

      await request(app)
        .post("/admin/users")
        .set("X-Admin-Key", adminApiKey)
        .send({
          username: "test-bob-designer",
          tags: ["backend", "nodejs"],
        });

      await request(app)
        .post("/admin/users")
        .set("X-Admin-Key", adminApiKey)
        .send({
          username: "test-charlie-developer",
          tags: ["frontend", "vue"],
        });

      await request(app)
        .post("/admin/users")
        .set("X-Admin-Key", adminApiKey)
        .send({
          username: "test-david-admin",
          tags: ["backend", "python"],
        });

      await request(app).post("/admin/users").set("X-Admin-Key", adminApiKey).send({
        username: "test-eve-tester",
        tags: [],
      });
    });

    it("should filter users by search term", async () => {
      // Act - search for "developer"
      const response = await request(app)
        .get("/admin/users")
        .query({ search: "developer" })
        .set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.OK);
      const usernames = response.body.users.map((u: any) => u.username);
      expect(usernames).toContain("test-alice-developer");
      expect(usernames).toContain("test-charlie-developer");
      expect(usernames).not.toContain("test-bob-designer");
      expect(usernames).not.toContain("test-david-admin");
      expect(response.body.filters.search).toEqual("developer");
    });

    it("should filter users by single tag", async () => {
      // Act - filter by "frontend" tag
      const response = await request(app)
        .get("/admin/users")
        .query({ tags: "frontend" })
        .set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.OK);
      const usernames = response.body.users.map((u: any) => u.username);
      expect(usernames).toContain("test-alice-developer");
      expect(usernames).toContain("test-charlie-developer");
      expect(usernames).not.toContain("test-bob-designer");
      expect(usernames).not.toContain("test-david-admin");
      expect(response.body.filters.tags).toEqual(["frontend"]);
    });

    it("should filter users by multiple tags (AND operation)", async () => {
      // Act - filter by both "backend" and "nodejs" tags
      const response = await request(app)
        .get("/admin/users")
        .query({ tags: ["backend", "nodejs"] })
        .set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.OK);
      const usernames = response.body.users.map((u: any) => u.username);
      expect(usernames).toContain("test-bob-designer"); // has both tags
      expect(usernames).not.toContain("test-david-admin"); // has only backend
      expect(response.body.filters.tags).toEqual(["backend", "nodejs"]);
    });

    it("should combine search and tag filters", async () => {
      // Act - search for "test" and filter by "frontend" tag
      const response = await request(app)
        .get("/admin/users")
        .query({ search: "alice", tags: "frontend" })
        .set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.OK);
      const usernames = response.body.users.map((u: any) => u.username);
      expect(usernames).toContain("test-alice-developer");
      expect(usernames).not.toContain("test-charlie-developer"); // has frontend but not alice
      expect(response.body.filters.search).toEqual("alice");
      expect(response.body.filters.tags).toEqual(["frontend"]);
    });

    it("should paginate results with page and limit", async () => {
      // Act - get page 2 with limit 2
      const response = await request(app)
        .get("/admin/users")
        .query({ page: 2, limit: 2 })
        .set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.body.users.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.page).toEqual(2);
      expect(response.body.pagination.limit).toEqual(2);
    });

    it("should return empty results for page beyond total", async () => {
      // Act - get page 1000
      const response = await request(app).get("/admin/users").query({ page: 1000 }).set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.body.users.length).toEqual(0);
      expect(response.body.pagination.page).toEqual(1000);
    });

    it("should sort by username ascending", async () => {
      // Act
      const response = await request(app)
        .get("/admin/users")
        .query({ sortBy: "username", order: "asc", search: "test-" })
        .set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.OK);
      const usernames = response.body.users.map((u: any) => u.username);
      const sortedUsernames = [...usernames].sort();
      expect(usernames).toEqual(sortedUsernames);
    });

    it("should sort by username descending", async () => {
      // Act
      const response = await request(app)
        .get("/admin/users")
        .query({ sortBy: "username", order: "desc", search: "test-" })
        .set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.OK);
      const usernames = response.body.users.map((u: any) => u.username);
      const sortedUsernames = [...usernames].sort().reverse();
      expect(usernames).toEqual(sortedUsernames);
    });

    it("should sort by createdAt", async () => {
      // Act
      const response = await request(app)
        .get("/admin/users")
        .query({ sortBy: "createdAt", order: "asc", search: "test-" })
        .set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.OK);
      const users = response.body.users;
      for (let i = 1; i < users.length; i++) {
        const prevDate = new Date(users[i - 1].createdAt);
        const currDate = new Date(users[i].createdAt);
        expect(prevDate.getTime()).toBeLessThanOrEqual(currDate.getTime());
      }
    });

    it("should return 400 for invalid page number", async () => {
      // Act
      const response = await request(app).get("/admin/users").query({ page: 0 }).set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      expect(response.body.error).toContain("Invalid page number");
    });

    it("should return 400 for invalid limit", async () => {
      // Act
      const response = await request(app).get("/admin/users").query({ limit: 101 }).set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      expect(response.body.error).toContain("Invalid limit");
    });

    it("should return 400 for negative limit", async () => {
      // Act
      const response = await request(app).get("/admin/users").query({ limit: -1 }).set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      expect(response.body.error).toContain("Invalid limit");
    });

    it("should handle case-insensitive search", async () => {
      // Act
      const response = await request(app)
        .get("/admin/users")
        .query({ search: "ALICE" })
        .set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.OK);
      const usernames = response.body.users.map((u: any) => u.username);
      expect(usernames).toContain("test-alice-developer");
    });

    it("should return empty results for non-matching search", async () => {
      // Act
      const response = await request(app)
        .get("/admin/users")
        .query({ search: "nonexistentuser" })
        .set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.body.users.length).toEqual(0);
      expect(response.body.pagination.total).toEqual(0);
      expect(response.body.pagination.totalPages).toEqual(0);
    });

    it("should return empty results for non-existing tags", async () => {
      // Act
      const response = await request(app)
        .get("/admin/users")
        .query({ tags: "nonexistingtag" })
        .set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.body.users.length).toEqual(0);
    });

    it("should apply default sorting by createdAt desc when not specified", async () => {
      // Act
      const response = await request(app)
        .get("/admin/users")
        .query({ search: "test-" })
        .set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.OK);
      const users = response.body.users;
      // Check that users are sorted by createdAt descending (newest first)
      for (let i = 1; i < users.length; i++) {
        const prevDate = new Date(users[i - 1].createdAt);
        const currDate = new Date(users[i].createdAt);
        expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime());
      }
    });

    it("should respect maximum page limit", async () => {
      // Act
      const response = await request(app).get("/admin/users").query({ limit: 100 }).set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.body.pagination.limit).toEqual(100);
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
      const responseBody: ErrorResponse = response.body;

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      expect(responseBody.error).toContain("User not found");
      expect(responseBody.status).toEqual(StatusCodes.NOT_FOUND);
      expect(responseBody.timestamp).toBeDefined();
    });

    it("should return a bad request for invalid username format", async () => {
      // Act
      const invalidUsername = "a"; // too short
      const response = await request(app).get(`/admin/users/${invalidUsername}`).set("X-Admin-Key", adminApiKey);
      const responseBody: ErrorResponse = response.body;

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      expect(responseBody.error).toContain("Invalid input");
      expect(responseBody.status).toEqual(StatusCodes.BAD_REQUEST);
    });

    it("should return user details for existing username with valid admin API key", async () => {
      // Arrange - create a user first
      await request(app).post("/admin/users").set("X-Admin-Key", adminApiKey).send({ username: "test-getuser" });

      // Act
      const response = await request(app).get("/admin/users/test-getuser").set("X-Admin-Key", adminApiKey);
      const responseBody: User = response.body;

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(responseBody.username).toEqual("test-getuser");
      expect(responseBody.id).toBeDefined();
      expect(responseBody.createdAt).toBeDefined();
      expect(responseBody.updatedAt).toBeDefined();
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
      expect(response.body.error).toContain("Invalid input");
      expect(response.body.status).toEqual(StatusCodes.BAD_REQUEST);
    });

    it("should return 400 for missing username", async () => {
      // Act
      const response = await request(app).post("/admin/users").set("X-Admin-Key", adminApiKey).send({});

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      expect(response.body.error).toContain("Invalid input");
      expect(response.body.status).toEqual(StatusCodes.BAD_REQUEST);
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

  describe("POST /admin/users/:username/deactivate", () => {
    let testUsername: string;
    let originalApiKey: string;

    beforeEach(async () => {
      // Create a test user for deactivation tests
      testUsername = `test-deactivate-${Date.now()}`;
      const createResponse = await request(app)
        .post("/admin/users")
        .set("X-Admin-Key", adminApiKey)
        .send({ username: testUsername });
      originalApiKey = createResponse.body.apiKey;
    });

    it("should return 401 without admin API key", async () => {
      // Act
      const response = await request(app).post(`/admin/users/${testUsername}/deactivate`);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });

    it("should return 401 with invalid admin API key", async () => {
      // Act
      const response = await request(app)
        .post(`/admin/users/${testUsername}/deactivate`)
        .set("X-Admin-Key", "invalid-key");

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });

    it("should deactivate user by regenerating API key", async () => {
      // Act
      const response = await request(app)
        .post(`/admin/users/${testUsername}/deactivate`)
        .set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.body.message).toContain(`${testUsername} has been deactivated`);
      expect(response.body.message).toContain("API key has been regenerated");
    });

    it("should invalidate old API key after deactivation", async () => {
      // Arrange - deactivate user
      await request(app).post(`/admin/users/${testUsername}/deactivate`).set("X-Admin-Key", adminApiKey);

      // Act - try to validate old API key
      const checkResponse = await request(app)
        .post(`/admin/users/${testUsername}/api-key/check`)
        .set("X-Admin-Key", adminApiKey)
        .send({ apiKey: originalApiKey });

      // Assert
      expect(checkResponse.statusCode).toEqual(StatusCodes.OK);
      expect(checkResponse.body.isValid).toBe(false);
    });

    it("should return 404 for non-existent user", async () => {
      // Act
      const response = await request(app)
        .post("/admin/users/test-nonexistent-user/deactivate")
        .set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      expect(response.body.error).toContain("User not found");
    });

    it("should return 400 for invalid username format", async () => {
      // Act
      const response = await request(app)
        .post("/admin/users/a/deactivate") // too short
        .set("X-Admin-Key", adminApiKey);

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      expect(response.body.error).toContain("Invalid input");
    });

    it("should allow deactivation multiple times", async () => {
      // Act - deactivate first time
      const firstResponse = await request(app)
        .post(`/admin/users/${testUsername}/deactivate`)
        .set("X-Admin-Key", adminApiKey);

      // Act - deactivate second time
      const secondResponse = await request(app)
        .post(`/admin/users/${testUsername}/deactivate`)
        .set("X-Admin-Key", adminApiKey);

      // Assert
      expect(firstResponse.statusCode).toEqual(StatusCodes.OK);
      expect(secondResponse.statusCode).toEqual(StatusCodes.OK);
      expect(secondResponse.body.message).toContain("has been deactivated");
    });
  });

  describe("POST /admin/users with tags", () => {
    it("should create a new user with tags", async () => {
      // Act
      const response = await request(app)
        .post("/admin/users")
        .set("X-Admin-Key", adminApiKey)
        .send({
          username: "test-user-with-tags",
          tags: ["frontend", "react", "typescript"],
        });

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.CREATED);
      expect(response.body.username).toEqual("test-user-with-tags");
      expect(response.body.apiKey).toMatch(/^ccs_[a-f0-9]{64}$/);

      // Verify tags were added by fetching user details
      const userResponse = await request(app).get("/admin/users/test-user-with-tags").set("X-Admin-Key", adminApiKey);

      expect(userResponse.body.tags).toEqual(["frontend", "react", "typescript"]);
    });

    it("should create user without tags when tags array is empty", async () => {
      // Act
      const response = await request(app).post("/admin/users").set("X-Admin-Key", adminApiKey).send({
        username: "test-user-no-tags",
        tags: [],
      });

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.CREATED);
      expect(response.body.username).toEqual("test-user-no-tags");

      // Verify no tags were added
      const userResponse = await request(app).get("/admin/users/test-user-no-tags").set("X-Admin-Key", adminApiKey);

      expect(userResponse.body.tags).toEqual([]);
    });

    it("should create user without tags when tags field is omitted", async () => {
      // Act
      const response = await request(app)
        .post("/admin/users")
        .set("X-Admin-Key", adminApiKey)
        .send({ username: "test-user-omitted-tags" });

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.CREATED);
      expect(response.body.username).toEqual("test-user-omitted-tags");

      // Verify no tags were added
      const userResponse = await request(app)
        .get("/admin/users/test-user-omitted-tags")
        .set("X-Admin-Key", adminApiKey);

      expect(userResponse.body.tags).toEqual([]);
    });

    it("should return 400 for invalid tag format", async () => {
      // Act
      const response = await request(app)
        .post("/admin/users")
        .set("X-Admin-Key", adminApiKey)
        .send({
          username: "test-user-invalid-tags",
          tags: ["valid-tag", "invalid@tag", "another_valid"],
        });

      // Assert
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      expect(response.body.error).toContain("Invalid input");
    });
  });
});
