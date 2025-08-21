import { StatusCodes } from "http-status-codes";
import request from "supertest";

import { app } from "@/server";

describe("Health API endpoints", () => {
	it("GET /health - success", async () => {
		const response = await request(app).get("/health");
		const result = response.body;

		expect(response.statusCode).toEqual(StatusCodes.OK);
		expect(result.status).toBeDefined();
		expect(result.database).toBeDefined();
		expect(result.timestamp).toBeDefined();
	});
});
