import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Request, type Response, type Router } from "express";
import { z } from "zod";

import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { checkDatabaseHealth } from "@/db/index";

export const healthRegistry = new OpenAPIRegistry();
export const healthRouter: Router = express.Router();

const HealthStatusSchema = z.object({
	status: z.string(),
	database: z.boolean(),
	timestamp: z.string(),
});

healthRegistry.registerPath({
	method: "get",
	path: "/health",
	tags: ["Health"],
	responses: createApiResponse(HealthStatusSchema, "Success"),
});

healthRouter.get("/", async (_req: Request, res: Response) => {
	const dbHealth = await checkDatabaseHealth();
	const healthStatus = {
		status: dbHealth ? "ok" : "degraded",
		database: dbHealth,
		timestamp: new Date().toISOString(),
	};

	const serviceResponse = ServiceResponse.success("Health check", healthStatus);
	res.status(serviceResponse.statusCode).send(serviceResponse);
});
