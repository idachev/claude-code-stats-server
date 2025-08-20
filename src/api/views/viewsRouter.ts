import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Request, type Response, type Router } from "express";
import { pino } from "pino";
import { z } from "zod";
import { StatsService } from "@/api/stats/statsService";
import type { DailyStats, ModelStats, StatsResponse } from "@/api/stats/statsTypes";
import { validateRequest } from "@/common/utils/httpHandlers";
import { db, modelUsage, users } from "@/db/index";

const logger = pino({ name: "views-router" });

export const viewsRegistry = new OpenAPIRegistry();
export const viewsRouter: Router = express.Router();

const statsService = new StatsService();

// Schema for dashboard query parameters
const DashboardQuerySchema = z.object({
	query: z.object({
		period: z.enum(["week", "month", "all"]).optional().default("week"),
		user: z.string().optional(),
		model: z.string().optional(),
		groupBy: z.enum(["user", "model"]).optional().default("user"),
	}),
});

// Register GET /dashboard endpoint
viewsRegistry.registerPath({
	method: "get",
	path: "/dashboard",
	tags: ["Views"],
	summary: "View statistics dashboard",
	description: "Display HTML dashboard with usage statistics charts and tables",
	request: {
		query: DashboardQuerySchema.shape.query,
	},
	responses: {
		200: {
			description: "HTML page with statistics dashboard",
			content: {
				"text/html": {
					schema: z.string(),
				},
			},
		},
	},
});

// Dashboard view endpoint
viewsRouter.get("/dashboard", validateRequest(DashboardQuerySchema), async (req: Request, res: Response) => {
	try {
		const { period, user, model, groupBy } = req.query as {
			period?: "week" | "month" | "all";
			user?: string;
			model?: string;
			groupBy?: "user" | "model";
		};

		// Get stats from service (handle "all" by using "month" as fallback)
		const statsPeriod = period === "all" ? "month" : period || "week";
		const stats = await statsService.getStats(statsPeriod, user, model);

		// Process data for charts with groupBy parameter
		const chartData = processStatsForCharts(stats, groupBy || "user");

		// Get unique users and models for filters
		const filters = await getAvailableFilters();

		// Render the dashboard view
		res.render("dashboard", {
			title: "Claude Code Stats Dashboard",
			stats: stats,
			chartData: chartData,
			filters: filters,
			query: {
				period: period || "week",
				user: user || "",
				model: model || "",
				groupBy: groupBy || "user",
			},
		});
	} catch (error: unknown) {
		logger.error(error, "Failed to render dashboard");
		res.status(500).render("error", {
			title: "Error",
			message: "Failed to load statistics dashboard",
			error: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

// Helper function to process stats for Chart.js
function processStatsForCharts(stats: StatsResponse, groupBy: "user" | "model" = "user") {
	if (!stats || !stats.stats) {
		return {
			daily: { labels: [], datasets: [] },
			models: { labels: [], datasets: [] },
			users: { labels: [], datasets: [] },
			groupBy: groupBy,
		};
	}

	// Process daily costs based on groupBy parameter
	if (groupBy === "model") {
		// Group by model
		interface ModelDailyAccumulator {
			dates: string[];
			models: string[];
			costs: Record<string, Record<string, number>>;
		}

		const modelDailyData = stats.stats.reduce(
			(acc: ModelDailyAccumulator, day: DailyStats) => {
				const date = day.date;
				if (!acc.dates.includes(date)) {
					acc.dates.push(date);
				}

				// Process each model for this day
				if (day.models) {
					day.models.forEach((model: ModelStats) => {
						const modelKey = `${model.provider}/${model.name}`;
						if (!acc.models.includes(modelKey)) {
							acc.models.push(modelKey);
						}

						if (!acc.costs[modelKey]) {
							acc.costs[modelKey] = {};
						}

						if (!acc.costs[modelKey][date]) {
							acc.costs[modelKey][date] = 0;
						}

						acc.costs[modelKey][date] += model.cost;
					});
				}

				return acc;
			},
			{ dates: [], models: [], costs: {} },
		);

		// Sort dates
		modelDailyData.dates.sort();

		// Create dataset for daily costs chart (grouped by model)
		const costDatasets = modelDailyData.models.map((model: string, idx: number) => ({
			label: model,
			data: modelDailyData.dates.map((date) => modelDailyData.costs[model]?.[date] || 0),
			borderColor: getColor(idx),
			backgroundColor: getColor(idx, 0.8),
			tension: 0.1,
		}));

		// Return early for model grouping
		return {
			daily: {
				labels: modelDailyData.dates,
				datasets: costDatasets,
			},
			models: { labels: [], datasets: [] },
			users: { labels: [], datasets: [] },
			groupBy: groupBy,
		};
	}

	// Default: Process daily costs by user
	interface DailyAccumulator {
		dates: string[];
		users: string[];
		costs: number[][];
		tokens: number[][];
	}
	const dailyData = stats.stats.reduce(
		(acc: DailyAccumulator, day: DailyStats) => {
			const date = day.date;
			if (!acc.dates.includes(date)) {
				acc.dates.push(date);
			}

			const userIndex = acc.users.indexOf(day.username);
			if (userIndex === -1) {
				acc.users.push(day.username);
				acc.costs.push([]);
				acc.tokens.push([]);
			}

			const dateIndex = acc.dates.indexOf(date);
			const currentUserIndex = acc.users.indexOf(day.username);

			if (!acc.costs[currentUserIndex]) acc.costs[currentUserIndex] = [];
			if (!acc.tokens[currentUserIndex]) acc.tokens[currentUserIndex] = [];

			acc.costs[currentUserIndex][dateIndex] = day.totalCost;
			acc.tokens[currentUserIndex][dateIndex] = day.totalTokens;

			return acc;
		},
		{ dates: [], users: [], costs: [], tokens: [] },
	);

	// Create dataset for daily costs chart
	const costDatasets = dailyData.users.map((user: string, idx: number) => ({
		label: user,
		data: dailyData.costs[idx] || [],
		borderColor: getColor(idx),
		backgroundColor: getColor(idx, 0.8),
		tension: 0.1,
	}));

	// Process model usage
	const modelUsage: Record<string, number> = {};
	stats.stats.forEach((day: DailyStats) => {
		if (day.models) {
			day.models.forEach((model: ModelStats) => {
				const key = `${model.provider}/${model.name}`;
				modelUsage[key] = (modelUsage[key] || 0) + model.cost;
			});
		}
	});

	const modelData = {
		labels: Object.keys(modelUsage),
		datasets: [
			{
				label: "Total Cost by Model",
				data: Object.values(modelUsage),
				backgroundColor: Object.keys(modelUsage).map((_, idx) => getColor(idx, 0.6)),
				borderColor: Object.keys(modelUsage).map((_, idx) => getColor(idx)),
				borderWidth: 1,
			},
		],
	};

	// Process user totals
	const userTotals: Record<string, { cost: number; tokens: number }> = {};
	stats.stats.forEach((day: DailyStats) => {
		if (!userTotals[day.username]) {
			userTotals[day.username] = { cost: 0, tokens: 0 };
		}
		userTotals[day.username].cost += day.totalCost;
		userTotals[day.username].tokens += day.totalTokens;
	});

	const userData = {
		labels: Object.keys(userTotals),
		datasets: [
			{
				label: "Total Cost by User",
				data: Object.values(userTotals).map((u) => u.cost),
				backgroundColor: Object.keys(userTotals).map((_, idx) => getColor(idx, 0.6)),
				borderColor: Object.keys(userTotals).map((_, idx) => getColor(idx)),
				borderWidth: 1,
			},
		],
	};

	return {
		daily: {
			labels: dailyData.dates,
			datasets: costDatasets,
		},
		models: modelData,
		users: userData,
		groupBy: groupBy,
	};
}

// Helper function to get available filters
async function getAvailableFilters() {
	try {
		// Get all unique users
		const usersResult = await db
			.select({
				username: users.username,
			})
			.from(users)
			.orderBy(users.username);

		// Get all unique model combinations
		const modelsResult = await db
			.select({
				provider: modelUsage.provider,
				model: modelUsage.model,
			})
			.from(modelUsage)
			.groupBy(modelUsage.provider, modelUsage.model)
			.orderBy(modelUsage.provider, modelUsage.model);

		// Format models as "provider/model"
		const uniqueModels = modelsResult.map((m) => `${m.provider}/${m.model}`);

		return {
			users: usersResult.map((u) => u.username),
			models: uniqueModels,
		};
	} catch (error) {
		logger.error(error, "Failed to get filters");
		return {
			users: [],
			models: [],
		};
	}
}

// Helper function to generate colors for charts
function getColor(index: number, alpha = 1): string {
	const colors = [
		`rgba(59, 130, 246, ${alpha})`, // blue
		`rgba(16, 185, 129, ${alpha})`, // green
		`rgba(251, 146, 60, ${alpha})`, // orange
		`rgba(147, 51, 234, ${alpha})`, // purple
		`rgba(236, 72, 153, ${alpha})`, // pink
		`rgba(251, 191, 36, ${alpha})`, // amber
		`rgba(100, 116, 139, ${alpha})`, // slate
		`rgba(6, 182, 212, ${alpha})`, // cyan
	];
	return colors[index % colors.length];
}
