import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import express, { type Request, type Response, type Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { createApiResponseWithErrors, createErrorApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { authenticateApiKey } from "@/common/middleware/apiKeyAuth";
import { createErrorResponse, validateRequest } from "@/common/utils/httpHandlers";
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
			.regex(/^[a-zA-Z0-9._-]+$/),
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
	description:
		"Upload ccusage JSON data for a specific user. Requires user API key authentication matching the username.",
	security: [{ ApiKeyAuth: [] }],
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
	responses: {
		[StatusCodes.NO_CONTENT]: {
			description: "Stats uploaded successfully",
		},
		...createErrorApiResponse("Bad Request", StatusCodes.BAD_REQUEST),
		...createErrorApiResponse("Unauthorized", StatusCodes.UNAUTHORIZED),
		...createErrorApiResponse("Internal Server Error", StatusCodes.INTERNAL_SERVER_ERROR),
	},
});

// Upload stats endpoint
statsRouter.post("/", authenticateApiKey, validateRequest(StatsUploadSchema), async (req: Request, res: Response) => {
	try {
		const { username } = req.query as { username: string };
		await statsService.uploadStats(username, req.body);

		// Return 204 No Content for success (no response body needed)
		res.status(StatusCodes.NO_CONTENT).send();
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : "Failed to upload stats";
		const statusCode = hasStatusCode(error) ? error.statusCode : StatusCodes.INTERNAL_SERVER_ERROR;
		const errorResponse = createErrorResponse(errorMessage, statusCode);
		res.status(statusCode).json(errorResponse);
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
	responses: createApiResponseWithErrors(
		z.object({
			period: z.enum(["week", "month", "custom", "all"]),
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
			summary: z
				.object({
					totalCost: z.number(),
					totalTokens: z.number(),
					uniqueUsers: z.number(),
					totalDays: z.number(),
				})
				.optional(),
		}),
		"Success",
	),
});

// Get stats endpoint (JSON for now)
statsRouter.get("/", validateRequest(StatsQuerySchema), async (req: Request, res: Response) => {
	try {
		const { period, user } = req.query as { period?: "week" | "month"; user?: string };

		// Calculate date range based on period
		const now = new Date();
		let startDate: Date;
		let endDate: Date;

		if (period === "month") {
			startDate = startOfMonth(now);
			endDate = endOfMonth(now);
		} else {
			// Default to week
			startDate = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
			endDate = endOfWeek(now, { weekStartsOn: 0 }); // Saturday
		}

		const stats = await statsService.getStatsForDateRange(startDate, endDate, user);

		// Return stats directly
		res.status(StatusCodes.OK).json(stats);
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : "Failed to retrieve stats";
		const statusCode = hasStatusCode(error) ? error.statusCode : StatusCodes.INTERNAL_SERVER_ERROR;
		const errorResponse = createErrorResponse(errorMessage, statusCode);
		res.status(statusCode).json(errorResponse);
	}
});
