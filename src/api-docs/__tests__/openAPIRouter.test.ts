import { StatusCodes } from "http-status-codes";
import request from "supertest";

import { app } from "@/server";

import { generateOpenAPIDocument } from "../openAPIDocumentGenerator";

describe("OpenAPI Router", () => {
	describe("Swagger JSON route", () => {
		it("should return Swagger JSON content", async () => {
			// Arrange
			const expectedResponse = generateOpenAPIDocument();

			// Act
			const response = await request(app).get("/swagger.json");

			// Assert
			expect(response.status).toBe(StatusCodes.OK);
			expect(response.type).toBe("application/json");
			expect(response.body).toEqual(expectedResponse);
		});

		it("should serve the Swagger UI at /swagger/", async () => {
			// Act
			const response = await request(app).get("/swagger/");

			// Assert
			expect(response.status).toBe(StatusCodes.OK);
			expect(response.text).toContain("swagger-ui");
		});

		it("should redirect /swagger to /swagger/ with trailing slash", async () => {
			// Act
			const response = await request(app).get("/swagger");

			// Assert
			expect(response.status).toBe(StatusCodes.MOVED_PERMANENTLY); // 301 redirect
			expect(response.headers.location).toBe("/swagger/");
		});

		it("should redirect root path to dashboard", async () => {
			// Act
			const response = await request(app).get("/");

			// Assert
			expect(response.status).toBe(302); // 302 redirect
			expect(response.headers.location).toBe("/dashboard");
		});
	});
});
