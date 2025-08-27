import { StatusCodes } from "http-status-codes";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TagService } from "@/api/tags/tagService";
import { UserRepository } from "@/api/user/userRepository";
import { UserService } from "@/api/user/userService";
import { db, users } from "@/db/index";
import { cleanupTestDatabase } from "@/test-utils/cleanupTestDatabase";

describe("userService", () => {
  let userServiceInstance: UserService;
  let userRepositoryInstance: UserRepository;
  let tagService: TagService;
  const timestamp = Date.now();
  const testUsernamePrefix = `test-service-${timestamp}-`;

  // Test user IDs to track for cleanup
  let testUser1Id: number;
  let _testUser2Id: number;

  beforeAll(async () => {
    // Clean database before starting tests
    await cleanupTestDatabase();

    tagService = new TagService();

    // Create test users with real data
    const [user1] = await db
      .insert(users)
      .values({
        username: `${testUsernamePrefix}alice`,
        apiKeyHash: "test-hash-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    testUser1Id = user1.id;

    // Add tags to user1
    await tagService.setUserTags(testUser1Id, ["developer", "team-alpha"]);

    const [user2] = await db
      .insert(users)
      .values({
        username: `${testUsernamePrefix}bob`,
        apiKeyHash: "test-hash-2",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    _testUser2Id = user2.id;
    // user2 has no tags
  });

  beforeEach(() => {
    userRepositoryInstance = new UserRepository();
    userServiceInstance = new UserService(userRepositoryInstance);
  });

  afterAll(async () => {
    // Final cleanup after all tests
    await cleanupTestDatabase();
  });

  describe("findAll", () => {
    it("return all users", async () => {
      // Act
      const result = await userServiceInstance.findAll();

      // Assert
      expect(result.statusCode).toEqual(StatusCodes.OK);
      expect(result.success).toBeTruthy();
      expect(result.message).equals("Users found");
      expect(result.responseObject).toBeDefined();

      // Check that our test users are in the results
      const data = result.responseObject;
      expect(data?.users).toBeDefined();
      const users = data?.users || [];
      const testUser1 = users.find((u: any) => u.username === `${testUsernamePrefix}alice`);
      const testUser2 = users.find((u: any) => u.username === `${testUsernamePrefix}bob`);

      expect(testUser1).toBeDefined();
      expect(testUser1?.tags).toEqual(["developer", "team-alpha"]);

      expect(testUser2).toBeDefined();
      expect(testUser2?.tags).toEqual([]);
    });

    it("returns users even with empty database", async () => {
      // Clean up all data temporarily
      await cleanupTestDatabase();

      // Act
      const result = await userServiceInstance.findAll();

      // Assert
      expect(result.statusCode).toEqual(StatusCodes.OK);
      expect(result.success).toBeTruthy();
      expect(result.message).equals("No users found");
      expect(result.responseObject?.users).toEqual([]);

      // Restore test users for other tests
      const [user1] = await db
        .insert(users)
        .values({
          username: `${testUsernamePrefix}alice`,
          apiKeyHash: "test-hash-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      testUser1Id = user1.id;
      await tagService.setUserTags(testUser1Id, ["developer", "team-alpha"]);

      const [user2] = await db
        .insert(users)
        .values({
          username: `${testUsernamePrefix}bob`,
          apiKeyHash: "test-hash-2",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      _testUser2Id = user2.id;
    });

    it("handles database connection errors gracefully", async () => {
      // Create a service with a faulty repository to simulate error
      // We can't easily simulate a database error with real DB,
      // so we'll create a custom repository that throws
      class FaultyRepository extends UserRepository {
        async findAllAsync(): Promise<any> {
          throw new Error("Database connection lost");
        }
      }

      const faultyRepository = new FaultyRepository();
      const serviceWithFaultyRepo = new UserService(faultyRepository);

      // Act
      const result = await serviceWithFaultyRepo.findAll();

      // Assert
      expect(result.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.success).toBeFalsy();
      expect(result.message).equals("An error occurred while retrieving users.");
      expect(result.responseObject).toBeNull();
    });
  });

  describe("findByUsername", () => {
    it("returns a user for a valid username", async () => {
      // Arrange
      const testUsername = `${testUsernamePrefix}alice`;

      // Act
      const result = await userServiceInstance.findByUsername(testUsername);

      // Assert
      expect(result.statusCode).toEqual(StatusCodes.OK);
      expect(result.success).toBeTruthy();
      expect(result.message).equals("User found");
      expect(result.responseObject).toBeDefined();

      const user = result.responseObject as any;
      expect(user.username).toBe(testUsername);
      expect(user.tags).toEqual(["developer", "team-alpha"]);
    });

    it("returns user without tags correctly", async () => {
      // Arrange
      const testUsername = `${testUsernamePrefix}bob`;

      // Act
      const result = await userServiceInstance.findByUsername(testUsername);

      // Assert
      expect(result.statusCode).toEqual(StatusCodes.OK);
      expect(result.success).toBeTruthy();
      expect(result.message).equals("User found");
      expect(result.responseObject).toBeDefined();

      const user = result.responseObject as any;
      expect(user.username).toBe(testUsername);
      expect(user.tags).toEqual([]);
    });

    it("returns a not found error for non-existent username", async () => {
      // Arrange
      const testUsername = `${testUsernamePrefix}nonexistent`;

      // Act
      const result = await userServiceInstance.findByUsername(testUsername);

      // Assert
      expect(result.statusCode).toEqual(StatusCodes.NOT_FOUND);
      expect(result.success).toBeFalsy();
      expect(result.message).equals("User not found");
      expect(result.responseObject).toBeNull();
    });

    it("handles database errors for findByUsername", async () => {
      // Create a service with a faulty repository to simulate error
      class FaultyRepository extends UserRepository {
        async findByUsernameAsync(_username: string): Promise<{
          tags: string[];
          username: string;
          id: number;
          isActive: boolean;
          createdAt: Date;
          updatedAt: Date;
        } | null> {
          throw new Error("Database query failed");
        }
      }

      const faultyRepository = new FaultyRepository();
      const serviceWithFaultyRepo = new UserService(faultyRepository);

      // Act
      const result = await serviceWithFaultyRepo.findByUsername("anyuser");

      // Assert
      expect(result.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(result.success).toBeFalsy();
      expect(result.message).equals("An error occurred while finding user.");
      expect(result.responseObject).toBeNull();
    });
  });

  describe("integration tests", () => {
    it("should handle users with special characters in username", async () => {
      // Create a user with special characters
      const specialUsername = `${testUsernamePrefix}user.with-special_chars`;
      const [_specialUser] = await db
        .insert(users)
        .values({
          username: specialUsername,
          apiKeyHash: "test-hash-special",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Test finding this user
      const result = await userServiceInstance.findByUsername(specialUsername);

      expect(result.statusCode).toEqual(StatusCodes.OK);
      expect(result.success).toBeTruthy();
      expect(result.responseObject).toBeDefined();

      const user = result.responseObject as any;
      expect(user.username).toBe(specialUsername);
    });

    it("should correctly return users with multiple tags", async () => {
      // Create a user with multiple tags
      const multiTagUsername = `${testUsernamePrefix}multitag`;
      const [multiTagUser] = await db
        .insert(users)
        .values({
          username: multiTagUsername,
          apiKeyHash: "test-hash-multitag",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // Add multiple tags
      await tagService.setUserTags(multiTagUser.id, ["backend", "frontend", "devops", "team-lead"]);

      // Test finding this user
      const result = await userServiceInstance.findByUsername(multiTagUsername);

      expect(result.statusCode).toEqual(StatusCodes.OK);
      const user = result.responseObject as any;
      expect(user.tags).toHaveLength(4);
      expect(user.tags).toContain("backend");
      expect(user.tags).toContain("frontend");
      expect(user.tags).toContain("devops");
      expect(user.tags).toContain("team-lead");
    });
  });
});
