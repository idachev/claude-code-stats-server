import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { addWeeks, endOfMonth, endOfWeek, getMonth, getWeek, getYear, startOfMonth, startOfWeek } from "date-fns";
import express, { type Request, type Response, type Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { UsernameSchema } from "@/api/user/userModel";
import { createApiResponseWithErrors, createErrorApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { authenticateApiKey } from "@/common/middleware/apiKeyAuth";
import { createErrorResponse, validateRequest } from "@/common/utils/httpHandlers";
import { StatsService } from "./statsService";
import type { StatsResponse } from "./statsTypes";

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
		username: UsernameSchema,
	}),
});

// Month names for validation
const MONTH_NAMES = [
	"january",
	"february",
	"march",
	"april",
	"may",
	"june",
	"july",
	"august",
	"september",
	"october",
	"november",
	"december",
] as const;

// Schema for query parameters
const StatsQuerySchema = z.object({
	query: z.object({
		period: z.enum(["week", "month", "all"]).optional().default("week"),
		year: z.coerce.number().optional(),
		month: z.enum(MONTH_NAMES).optional(),
		week: z.coerce.number().min(1).max(53).optional(),
		user: z.string().optional(),
		model: z.string().optional(),
		tags: z.union([z.string().transform((val) => val.split(",")), z.array(z.string())]).optional(),
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
	description: "Get aggregated usage statistics for a specific period with optional filters by user, model, and tags",
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
		const { period, year, month, week, user, model, tags } = req.query as {
			period?: "week" | "month" | "all";
			year?: number;
			month?: (typeof MONTH_NAMES)[number];
			week?: number;
			user?: string;
			model?: string;
			tags?: string[];
		};

		const today = new Date();
		const currentYear = getYear(today);
		const currentWeek = getWeek(today, { weekStartsOn: 0 }); // Sunday as start
		const currentMonth = getMonth(today); // 0-indexed

		let stats: StatsResponse;

		if (period === "all") {
			// For "all" view, get all data
			stats = await statsService.getAllStats(user, model, tags);
		} else {
			// Calculate date range based on period and navigation parameters
			let startDate: Date;
			let endDate: Date;

			if (period === "month") {
				// Handle month view
				const navYear = year || currentYear;
				const navMonth = month ? MONTH_NAMES.indexOf(month) : currentMonth;

				const navDate = new Date(navYear, navMonth, 1);
				startDate = startOfMonth(navDate);
				endDate = endOfMonth(navDate);
			} else {
				// Handle week view (default)
				const navYear = year || currentYear;
				const navWeek = week || currentWeek;

				// Calculate the date for this week number
				// Start with January 1st of the year
				const yearStart = new Date(navYear, 0, 1);
				const januaryFirstWeek = getWeek(yearStart, { weekStartsOn: 0 });

				// Calculate how many weeks to add from January 1st
				const weeksToAdd = navWeek - januaryFirstWeek;
				const targetDate = addWeeks(yearStart, weeksToAdd);

				startDate = startOfWeek(targetDate, { weekStartsOn: 0 });
				endDate = endOfWeek(targetDate, { weekStartsOn: 0 });
			}

			stats = await statsService.getStatsForDateRange(startDate, endDate, user, model, tags);
		}

		// Return stats directly
		res.status(StatusCodes.OK).json(stats);
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : "Failed to retrieve stats";
		const statusCode = hasStatusCode(error) ? error.statusCode : StatusCodes.INTERNAL_SERVER_ERROR;
		const errorResponse = createErrorResponse(errorMessage, statusCode);
		res.status(statusCode).json(errorResponse);
	}
});
