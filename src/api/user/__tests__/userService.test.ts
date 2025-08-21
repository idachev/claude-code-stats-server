import { StatusCodes } from "http-status-codes";
import type { Mock } from "vitest";

import type { User } from "@/api/user/userModel";
import { UserRepository } from "@/api/user/userRepository";
import { UserService } from "@/api/user/userService";

vi.mock("@/api/user/userRepository");

describe("userService", () => {
	let userServiceInstance: UserService;
	let userRepositoryInstance: UserRepository;

	const mockUsers: User[] = [
		{
			id: 1,
			username: "alice",
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		{
			id: 2,
			username: "bob",
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	];

	beforeEach(() => {
		userRepositoryInstance = new UserRepository();
		userServiceInstance = new UserService(userRepositoryInstance);
	});

	describe("findAll", () => {
		it("return all users", async () => {
			// Arrange
			(userRepositoryInstance.findAllAsync as Mock).mockReturnValue(mockUsers);

			// Act
			const result = await userServiceInstance.findAll();

			// Assert
			expect(result.statusCode).toEqual(StatusCodes.OK);
			expect(result.success).toBeTruthy();
			expect(result.message).equals("Users found");
			expect(result.responseObject).toEqual(mockUsers);
		});

		it("returns a not found error for no users found", async () => {
			// Arrange
			(userRepositoryInstance.findAllAsync as Mock).mockReturnValue(null);

			// Act
			const result = await userServiceInstance.findAll();

			// Assert
			expect(result.statusCode).toEqual(StatusCodes.NOT_FOUND);
			expect(result.success).toBeFalsy();
			expect(result.message).equals("No Users found");
			expect(result.responseObject).toBeNull();
		});

		it("handles errors for findAllAsync", async () => {
			// Arrange
			(userRepositoryInstance.findAllAsync as Mock).mockRejectedValue(new Error("Database error"));

			// Act
			const result = await userServiceInstance.findAll();

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
			const testUsername = "alice";
			const mockUser = mockUsers.find((user) => user.username === testUsername);
			(userRepositoryInstance.findByUsernameAsync as Mock).mockReturnValue(mockUser);

			// Act
			const result = await userServiceInstance.findByUsername(testUsername);

			// Assert
			expect(result.statusCode).toEqual(StatusCodes.OK);
			expect(result.success).toBeTruthy();
			expect(result.message).equals("User found");
			expect(result.responseObject).toEqual(mockUser);
		});

		it("handles errors for findByUsernameAsync", async () => {
			// Arrange
			const testUsername = "alice";
			(userRepositoryInstance.findByUsernameAsync as Mock).mockRejectedValue(new Error("Database error"));

			// Act
			const result = await userServiceInstance.findByUsername(testUsername);

			// Assert
			expect(result.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
			expect(result.success).toBeFalsy();
			expect(result.message).equals("An error occurred while finding user.");
			expect(result.responseObject).toBeNull();
		});

		it("returns a not found error for non-existent username", async () => {
			// Arrange
			const testUsername = "nonexistent";
			(userRepositoryInstance.findByUsernameAsync as Mock).mockReturnValue(null);

			// Act
			const result = await userServiceInstance.findByUsername(testUsername);

			// Assert
			expect(result.statusCode).toEqual(StatusCodes.NOT_FOUND);
			expect(result.success).toBeFalsy();
			expect(result.message).equals("User not found");
			expect(result.responseObject).toBeNull();
		});
	});
});
