import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
	addMonths,
	addWeeks,
	endOfMonth,
	endOfWeek,
	format,
	getMonth,
	getWeek,
	getYear,
	isAfter,
	isSameMonth,
	isSameWeek,
	startOfMonth,
	startOfWeek,
	subMonths,
	subWeeks,
} from "date-fns";
import express, { type Request, type Response, type Router } from "express";
import { pino } from "pino";
import { z } from "zod";
import { StatsService } from "@/api/stats/statsService";
import type { DailyStats, ModelStats, StatsResponse } from "@/api/stats/statsTypes";
import { UserRepository } from "@/api/user/userRepository";
import { validateRequest } from "@/common/utils/httpHandlers";
import { db, modelUsage } from "@/db/index";

const logger = pino({ name: "views-router" });

export const viewsRegistry = new OpenAPIRegistry();
export const viewsRouter: Router = express.Router();

const statsService = new StatsService();
const userRepository = new UserRepository();

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

// Schema for dashboard query parameters
const DashboardQuerySchema = z.object({
	query: z.object({
		period: z.enum(["week", "month", "all"]).optional().default("week"),
		year: z.coerce.number().optional(),
		month: z.enum(MONTH_NAMES).optional(),
		week: z.coerce.number().min(1).max(53).optional(),
		user: z.string().optional(),
		model: z.string().optional(),
		tags: z.union([z.string().transform((val) => val.split(",")), z.array(z.string())]).optional(),
		groupBy: z.enum(["user", "model"]).optional().default("user"),
		metric: z.enum(["cost", "tokens"]).optional().default("tokens"),
	}),
});

// Register GET / endpoint (root redirect)
viewsRegistry.registerPath({
	method: "get",
	path: "/",
	tags: ["Views"],
	summary: "Root redirect to dashboard",
	description: "Redirects from root path to the statistics dashboard",
	responses: {
		302: {
			description: "Redirect to /dashboard",
			headers: {
				Location: {
					description: "Redirect location",
					schema: { type: "string", example: "/dashboard" },
				},
			},
		},
	},
});

// Root route - redirect to dashboard
viewsRouter.get("/", (_req: Request, res: Response) => {
	res.redirect("/dashboard");
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
		const { period, year, month, week, user, model, tags, groupBy, metric } = req.query as {
			period?: "week" | "month" | "all";
			year?: number;
			month?: (typeof MONTH_NAMES)[number];
			week?: number;
			user?: string;
			model?: string;
			tags?: string | string[];
			groupBy?: "user" | "model";
			metric?: "cost" | "tokens";
		};

		// Ensure tags is always an array
		const tagsArray = tags ? (Array.isArray(tags) ? tags : [tags]) : undefined;

		const today = new Date();
		const currentYear = getYear(today);
		const currentWeek = getWeek(today, { weekStartsOn: 0 }); // Sunday as start
		const currentMonth = getMonth(today); // 0-indexed

		let displayDate = "";
		let dateRange: { start: Date; end: Date } | null = null;
		const navigationParams: {
			prev: Record<string, string | number> | null;
			next: Record<string, string | number> | null;
			current: Record<string, string | number>;
		} = {
			prev: null,
			next: null,
			current: {},
		};

		if (period === "all") {
			// For "all" view, show "All Time" and disable navigation
			displayDate = "All Time";
			navigationParams.current = { period: "all" };
		} else if (period === "month") {
			// Handle month view
			const navYear = year || currentYear;
			const navMonth = month ? MONTH_NAMES.indexOf(month) : currentMonth;

			const navDate = new Date(navYear, navMonth, 1);
			const monthStart = startOfMonth(navDate);
			const monthEnd = endOfMonth(navDate);

			dateRange = { start: monthStart, end: monthEnd };
			displayDate = format(navDate, "MMMM yyyy");

			// Calculate prev month
			const prevMonth = subMonths(navDate, 1);
			navigationParams.prev = {
				period: "month",
				year: getYear(prevMonth),
				month: MONTH_NAMES[getMonth(prevMonth)],
			};

			// Calculate next month (only if not current month)
			if (!isSameMonth(navDate, today)) {
				const nextMonth = addMonths(navDate, 1);
				// Only allow next if it's not in the future
				if (!isAfter(nextMonth, today)) {
					navigationParams.next = {
						period: "month",
						year: getYear(nextMonth),
						month: MONTH_NAMES[getMonth(nextMonth)],
					};
				}
			}

			navigationParams.current = {
				period: "month",
				year: navYear,
				month: MONTH_NAMES[navMonth],
			};
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

			const weekStart = startOfWeek(targetDate, { weekStartsOn: 0 });
			const weekEnd = endOfWeek(targetDate, { weekStartsOn: 0 });

			dateRange = { start: weekStart, end: weekEnd };
			displayDate = `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;

			// Calculate prev week
			const prevWeekDate = subWeeks(weekStart, 1);
			const prevWeekNum = getWeek(prevWeekDate, { weekStartsOn: 0 });
			const prevWeekYear = getYear(prevWeekDate);

			navigationParams.prev = {
				period: "week",
				year: prevWeekYear,
				week: prevWeekNum,
			};

			// Calculate next week (only if not current week)
			if (!isSameWeek(weekStart, today, { weekStartsOn: 0 })) {
				const nextWeekDate = addWeeks(weekStart, 1);
				// Only allow next if it's not in the future
				if (!isAfter(nextWeekDate, today)) {
					const nextWeekNum = getWeek(nextWeekDate, { weekStartsOn: 0 });
					const nextWeekYear = getYear(nextWeekDate);

					navigationParams.next = {
						period: "week",
						year: nextWeekYear,
						week: nextWeekNum,
					};
				}
			}

			navigationParams.current = {
				period: "week",
				year: navYear,
				week: navWeek,
			};
		}

		// Get stats from service with the date range and tag filters
		let stats: StatsResponse;
		if (period === "all") {
			// For "all" view, get all data
			stats = await statsService.getAllStats(user, model, tagsArray);
		} else if (dateRange) {
			// For week/month view, pass the date range
			stats = await statsService.getStatsForDateRange(dateRange.start, dateRange.end, user, model, tagsArray);
		} else {
			// Fallback to empty stats (should not happen with proper validation)
			stats = {
				period: "custom",
				startDate: new Date().toISOString(),
				endDate: new Date().toISOString(),
				stats: [],
				summary: { totalCost: 0, totalTokens: 0, uniqueUsers: 0, totalDays: 0 },
			};
		}

		// Process data for charts with groupBy parameter
		const chartData = processStatsForCharts(stats, groupBy || "user");

		// Get unique users with tags, models, and all available tags for filters
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
				tags: tagsArray || [],
				groupBy: groupBy || "user",
				metric: metric || "tokens",
				...navigationParams.current,
			},
			navigation: {
				displayDate,
				prev: navigationParams.prev,
				next: navigationParams.next,
				current: navigationParams.current,
				canNavigate: period !== "all",
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
		// Get all users with their tags - use simple version for backward compatibility
		const usersWithTags = await userRepository.findAllSimpleAsync();

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

		// Get all unique tags (case-insensitive)
		const tagMap = new Map<string, string>(); // lowercase -> original
		usersWithTags.forEach((u) => {
			u.tags.forEach((tag) => {
				const key = tag.toLowerCase();
				if (!tagMap.has(key)) {
					tagMap.set(key, tag);
				}
			});
		});

		return {
			users: usersWithTags.map((u) => u.username),
			usersWithTags: usersWithTags,
			models: uniqueModels,
			tags: Array.from(tagMap.values()).sort(),
		};
	} catch (error) {
		logger.error(error, "Failed to get filters");
		return {
			users: [],
			usersWithTags: [],
			models: [],
			tags: [],
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
