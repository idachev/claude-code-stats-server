import { StatusCodes } from "http-status-codes";
import request from "supertest";

import type { User } from "@/api/user/userModel";
import type { ServiceResponse } from "@/common/models/serviceResponse";
import { app } from "@/server";

describe("User API Endpoints", () => {
	const adminApiKey = process.env.ADMIN_API_KEY || "test-admin-key";

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
			expect(responseBody.message).toContain("Users found");
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
	});
});
