import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Request, type Response, type Router } from "express";
import { z } from "zod";
import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { validateRequest } from "@/common/utils/httpHandlers";
import { StatsService } from "./statsService";

// Type guard for errors with statusCode
interface ErrorWithStatusCode extends Error {
	statusCode: number;
}

function hasStatusCode(error: unknown): error is ErrorWithStatusCode {
	return (
		error instanceof Error && "statusCode" in error && typeof (error as ErrorWithStatusCode).statusCode === "number"
	);
}

export const statsRegistry = new OpenAPIRegistry();
export const statsRouter: Router = express.Router();

const statsService = new StatsService();

// Schema for the ccusage JSON body
const CcusageBodySchema = z.object({
	daily: z.array(
		z.object({
			date: z.string(),
			inputTokens: z.number(),
			outputTokens: z.number(),
			cacheCreationTokens: z.number().optional(),
			cacheReadTokens: z.number().optional(),
			totalTokens: z.number(),
			totalCost: z.number(),
			modelsUsed: z.array(z.string()).optional(),
			modelBreakdowns: z
				.array(
					z.object({
						modelName: z.string(),
						provider: z.string().optional(),
						inputTokens: z.number(),
						outputTokens: z.number(),
						cacheCreationTokens: z.number().optional(),
						cacheReadTokens: z.number().optional(),
						cost: z.number(),
					}),
				)
				.optional(),
		}),
	),
});

// Schema for upload request
const StatsUploadSchema = z.object({
	body: CcusageBodySchema,
	query: z.object({
		username: z
			.string()
			.min(3)
			.max(50)
			.regex(/^[a-zA-Z0-9_-]+$/),
	}),
});

// Schema for query parameters
const StatsQuerySchema = z.object({
	query: z.object({
		period: z.enum(["week", "month"]).optional().default("week"),
		user: z.string().optional(),
	}),
});

// Register POST /claude-code-stats endpoint
statsRegistry.registerPath({
	method: "post",
	path: "/claude-code-stats",
	tags: ["Statistics"],
	summary: "Upload usage statistics",
	description: "Upload ccusage JSON data for a specific user",
	request: {
		query: StatsUploadSchema.shape.query,
		body: {
			content: {
				"application/json": {
					schema: CcusageBodySchema,
				},
			},
			description: "ccusage JSON data with daily usage statistics",
			required: true,
		},
	},
	responses: createApiResponse(z.null(), "Success"),
});

// Upload stats endpoint
statsRouter.post("/", validateRequest(StatsUploadSchema), async (req: Request, res: Response) => {
	try {
		const { username } = req.query as { username: string };
		await statsService.uploadStats(username, req.body);

		const serviceResponse = ServiceResponse.success(
			"Stats uploaded successfully",
			null, // No additional response object needed
		);
		res.status(serviceResponse.statusCode).send(serviceResponse);
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : "Failed to upload stats";
		const statusCode = hasStatusCode(error) ? error.statusCode : 500;
		const serviceResponse = ServiceResponse.failure(errorMessage, null, statusCode);
		res.status(serviceResponse.statusCode).send(serviceResponse);
	}
});

// Register GET /claude-code-stats endpoint (returns JSON for now, will add EJS view later)
statsRegistry.registerPath({
	method: "get",
	path: "/claude-code-stats",
	tags: ["Statistics"],
	summary: "Retrieve usage statistics",
	description: "Get aggregated usage statistics for a specific period and optionally filter by user",
	request: {
		query: StatsQuerySchema.shape.query,
	},
	responses: createApiResponse(
		z.object({
			period: z.enum(["week", "month"]),
			startDate: z.string(),
			endDate: z.string(),
			stats: z.array(
				z.object({
					date: z.string(),
					username: z.string(),
					totalCost: z.number(),
					totalTokens: z.number(),
					inputTokens: z.number(),
					outputTokens: z.number(),
					cacheCreationInputTokens: z.number(),
					cacheReadInputTokens: z.number(),
					models: z.array(
						z.object({
							name: z.string(),
							provider: z.string(),
							cost: z.number(),
							inputTokens: z.number(),
							outputTokens: z.number(),
							cacheCreationInputTokens: z.number(),
							cacheReadInputTokens: z.number(),
						}),
					),
				}),
			),
		}),
		"Success",
	),
});

// Get stats endpoint (JSON for now)
statsRouter.get("/", validateRequest(StatsQuerySchema), async (req: Request, res: Response) => {
	try {
		const { period, user } = req.query as { period?: "week" | "month"; user?: string };
		const stats = await statsService.getStats(period || "week", user);

		const serviceResponse = ServiceResponse.success("Stats retrieved", stats);
		res.status(serviceResponse.statusCode).send(serviceResponse);
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : "Failed to retrieve stats";
		const statusCode = hasStatusCode(error) ? error.statusCode : 500;
		const serviceResponse = ServiceResponse.failure(errorMessage, null, statusCode);
		res.status(serviceResponse.statusCode).send(serviceResponse);
	}
});
