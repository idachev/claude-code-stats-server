import { StatusCodes } from "http-status-codes";
import request from "supertest";

import type { ServiceResponse } from "@/common/models/serviceResponse";
import { app } from "@/server";

describe("Health API endpoints", () => {
	it("GET /health - success", async () => {
		const response = await request(app).get("/health");
		const result: ServiceResponse = response.body;

		expect(response.statusCode).toEqual(StatusCodes.OK);
		expect(result.success).toBeTruthy();
		expect(result.responseObject).not.toBeNull();
		expect(result.message).toEqual("Health check");
	});
});
