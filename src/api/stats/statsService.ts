import { and, desc, eq, gte } from "drizzle-orm";
import { pino } from "pino";
import { db, modelUsage, type NewModelUsage, type NewUsageStats, usageStats, users } from "@/db/index";
import type { CCUsageData, StatsResponse } from "./statsTypes";

const logger = pino({ name: "StatsService" });

export class StatsService {
	async uploadStats(username: string, data: unknown): Promise<void> {
		// Validate the JSON structure
		if (!data || typeof data !== "object") {
			throw new Error("Invalid JSON data");
		}

		// Check if it's ccusage format with daily array
		const ccData = data as { daily?: unknown };
		if (!ccData.daily || !Array.isArray(ccData.daily)) {
			throw new Error("Invalid ccusage format - missing daily array");
		}

		// Now we know it's a valid CCUsageData
		const validData = ccData as CCUsageData;

		// Start transaction
		await db.transaction(async (tx) => {
			// Find or create user
			let [user] = await tx.select().from(users).where(eq(users.username, username));

			if (!user) {
				const [newUser] = await tx.insert(users).values({ username }).returning();
				user = newUser;
				logger.info(`Created new user: ${username}`);
			}

			// Process each day in the daily array
			for (const dayData of validData.daily) {
				if (!dayData.date) continue;

				const date = dayData.date; // Keep as string in YYYY-MM-DD format

				// Check if stats already exist for this date
				const [existingStats] = await tx
					.select()
					.from(usageStats)
					.where(and(eq(usageStats.userId, user.id), eq(usageStats.date, date)));

				// If exists, delete old model usages
				if (existingStats) {
					await tx.delete(modelUsage).where(eq(modelUsage.usageStatsId, existingStats.id));
				}

				// Create or update usage stats
				const statsData: NewUsageStats = {
					userId: user.id,
					date,
					inputTokens: dayData.inputTokens || 0,
					outputTokens: dayData.outputTokens || 0,
					cacheCreationInputTokens: dayData.cacheCreationTokens || 0,
					cacheReadInputTokens: dayData.cacheReadTokens || 0,
					totalTokens: dayData.totalTokens || 0,
					totalCost: (dayData.totalCost || 0).toString(),
				};

				let statsId: number;

				if (existingStats) {
					// Update existing stats
					await tx
						.update(usageStats)
						.set({
							...statsData,
							updatedAt: new Date(),
						})
						.where(eq(usageStats.id, existingStats.id));
					statsId = existingStats.id;
				} else {
					// Insert new stats
					const [newStats] = await tx.insert(usageStats).values(statsData).returning();
					statsId = newStats.id;
				}

				// Process model breakdowns
				if (dayData.modelBreakdowns && Array.isArray(dayData.modelBreakdowns)) {
					for (const modelData of dayData.modelBreakdowns) {
						const modelUsageData: NewModelUsage = {
							usageStatsId: statsId,
							model: modelData.modelName || "unknown",
							provider: modelData.provider || "anthropic",
							inputTokens: modelData.inputTokens || 0,
							outputTokens: modelData.outputTokens || 0,
							cacheCreationInputTokens: modelData.cacheCreationTokens || 0,
							cacheReadInputTokens: modelData.cacheReadTokens || 0,
							cost: (modelData.cost || 0).toString(),
						};

						await tx.insert(modelUsage).values(modelUsageData);
					}
				}

				logger.info(`Stats uploaded for user ${username} on ${dayData.date}`);
			}
		});
	}

	async getStats(period: "week" | "month", username?: string, model?: string): Promise<StatsResponse> {
		const days = period === "week" ? 7 : 30;
		const startDate = new Date();
		startDate.setDate(startDate.getDate() - days);
		const startDateStr = startDate.toISOString().split("T")[0];

		// Build query
		const query = db
			.select({
				date: usageStats.date,
				username: users.username,
				totalCost: usageStats.totalCost,
				totalTokens: usageStats.totalTokens,
				inputTokens: usageStats.inputTokens,
				outputTokens: usageStats.outputTokens,
				cacheCreationInputTokens: usageStats.cacheCreationInputTokens,
				cacheReadInputTokens: usageStats.cacheReadInputTokens,
				userId: users.id,
				statsId: usageStats.id,
			})
			.from(usageStats)
			.innerJoin(users, eq(usageStats.userId, users.id))
			.where(gte(usageStats.date, startDateStr))
			.orderBy(desc(usageStats.date));

		// Add username filter if provided
		let statsResults: Awaited<typeof query>;
		if (username) {
			statsResults = await db
				.select({
					date: usageStats.date,
					username: users.username,
					totalCost: usageStats.totalCost,
					totalTokens: usageStats.totalTokens,
					inputTokens: usageStats.inputTokens,
					outputTokens: usageStats.outputTokens,
					cacheCreationInputTokens: usageStats.cacheCreationInputTokens,
					cacheReadInputTokens: usageStats.cacheReadInputTokens,
					userId: users.id,
					statsId: usageStats.id,
				})
				.from(usageStats)
				.innerJoin(users, eq(usageStats.userId, users.id))
				.where(and(gte(usageStats.date, startDateStr), eq(users.username, username)))
				.orderBy(desc(usageStats.date));
		} else {
			statsResults = await query;
		}

		// Get model usage for each stat
		const statsWithModels = await Promise.all(
			statsResults.map(async (stat: (typeof statsResults)[0]) => {
				const models = await db.select().from(modelUsage).where(eq(modelUsage.usageStatsId, stat.statsId));

				// Filter models if model parameter is provided
				let filteredModels = models;
				if (model) {
					// model parameter is in format "provider/model"
					const [provider, modelName] = model.split("/");
					if (provider && modelName) {
						filteredModels = models.filter((m) => m.provider === provider && m.model === modelName);
					}
				}

				// Only include stats that have the filtered model (or all models if no filter)
				if (model && filteredModels.length === 0) {
					return null; // This stat doesn't have the requested model
				}

				// Recalculate totals based on filtered models
				const recalculatedCost = filteredModels.reduce((sum, m) => sum + parseFloat(m.cost), 0);
				const recalculatedTokens = filteredModels.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0);
				const recalculatedInputTokens = filteredModels.reduce((sum, m) => sum + m.inputTokens, 0);
				const recalculatedOutputTokens = filteredModels.reduce((sum, m) => sum + m.outputTokens, 0);
				const recalculatedCacheCreation = filteredModels.reduce((sum, m) => sum + m.cacheCreationInputTokens, 0);
				const recalculatedCacheRead = filteredModels.reduce((sum, m) => sum + m.cacheReadInputTokens, 0);

				return {
					date: stat.date,
					username: stat.username,
					totalCost: model ? recalculatedCost : parseFloat(stat.totalCost),
					totalTokens: model ? recalculatedTokens : stat.totalTokens,
					inputTokens: model ? recalculatedInputTokens : stat.inputTokens,
					outputTokens: model ? recalculatedOutputTokens : stat.outputTokens,
					cacheCreationInputTokens: model ? recalculatedCacheCreation : stat.cacheCreationInputTokens,
					cacheReadInputTokens: model ? recalculatedCacheRead : stat.cacheReadInputTokens,
					models: filteredModels.map((m) => ({
						name: m.model,
						provider: m.provider,
						cost: parseFloat(m.cost),
						inputTokens: m.inputTokens,
						outputTokens: m.outputTokens,
						cacheCreationInputTokens: m.cacheCreationInputTokens,
						cacheReadInputTokens: m.cacheReadInputTokens,
					})),
				};
			}),
		);

		// Filter out null results (stats that don't have the requested model)
		const filteredStats = statsWithModels.filter((stat) => stat !== null);

		// Transform results for response
		return {
			period,
			startDate: startDate.toISOString(),
			endDate: new Date().toISOString(),
			stats: filteredStats,
		};
	}
}
