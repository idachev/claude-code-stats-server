import { format } from "date-fns";
import { and, desc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { pino } from "pino";
import { TagService } from "@/api/tags/tagService";
import { db, modelUsage, type NewModelUsage, type NewUsageStats, usageStats, users } from "@/db/index";
import type { CCUsageData, DailyStats, StatsResponse } from "./statsTypes";

const logger = pino({ name: "StatsService" });

export class StatsService {
  private tagService: TagService;

  constructor() {
    this.tagService = new TagService();
  }

  // Helper method to get user IDs filtered by tags
  private async getUserIdsByTags(tags: string[]): Promise<number[] | null> {
    if (tags.length === 0) {
      return null; // No tag filter
    }

    // Get users that have ALL specified tags
    return await this.tagService.getUsersByTags(tags);
  }

  // Helper method to add tags condition to query conditions
  // Returns false if no users match the tags (should return empty response), true otherwise
  private async addTagsCondition(conditions: SQL[], tags?: string[]): Promise<boolean> {
    if (!tags || tags.length === 0) {
      return true;
    }

    const userIds = await this.getUserIdsByTags(tags);
    if (userIds && userIds.length > 0) {
      conditions.push(inArray(users.id, userIds));
      return true;
    }

    return false;
  }

  // Helper method to create empty stats response
  private createEmptyStatsResponse(period: "custom" | "all", startDate?: Date, endDate?: Date): StatsResponse {
    return {
      period,
      startDate: startDate?.toISOString() || new Date().toISOString(),
      endDate: endDate?.toISOString() || new Date().toISOString(),
      stats: [],
      summary: {
        totalCost: 0,
        totalTokens: 0,
        uniqueUsers: 0,
        totalDays: 0,
      },
    };
  }

  // Helper method to fetch base stats data
  private async fetchStatsData(conditions: SQL[]): Promise<
    Array<{
      date: string;
      username: string;
      totalCost: string;
      totalTokens: number;
      inputTokens: number;
      outputTokens: number;
      cacheCreationInputTokens: number;
      cacheReadInputTokens: number;
      userId: number;
      statsId: number;
    }>
  > {
    return await db
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
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(usageStats.date));
  }

  // Helper method to process stats with model filtering
  private async processStatsWithModels(
    statsResults: Array<{
      date: string;
      username: string;
      totalCost: string;
      totalTokens: number;
      inputTokens: number;
      outputTokens: number;
      cacheCreationInputTokens: number;
      cacheReadInputTokens: number;
      userId: number;
      statsId: number;
    }>,
    modelFilter?: string,
  ): Promise<(DailyStats | null)[]> {
    return await Promise.all(
      statsResults.map(async (stat) => {
        const models = await db.select().from(modelUsage).where(eq(modelUsage.usageStatsId, stat.statsId));

        // Filter models if model parameter is provided
        let filteredModels = models;
        if (modelFilter) {
          // model parameter is in format "provider/model"
          const [provider, modelName] = modelFilter.split("/");
          if (provider && modelName) {
            filteredModels = models.filter((m) => m.provider === provider && m.model === modelName);
          }
        }

        // Only include stats that have the filtered model (or all models if no filter)
        if (modelFilter && filteredModels.length === 0) {
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
          totalCost: modelFilter ? recalculatedCost : parseFloat(stat.totalCost),
          totalTokens: modelFilter ? recalculatedTokens : stat.totalTokens,
          inputTokens: modelFilter ? recalculatedInputTokens : stat.inputTokens,
          outputTokens: modelFilter ? recalculatedOutputTokens : stat.outputTokens,
          cacheCreationInputTokens: modelFilter ? recalculatedCacheCreation : stat.cacheCreationInputTokens,
          cacheReadInputTokens: modelFilter ? recalculatedCacheRead : stat.cacheReadInputTokens,
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
  }

  // Helper method to calculate summary statistics
  private calculateSummary(stats: DailyStats[]): {
    totalCost: number;
    totalTokens: number;
    uniqueUsers: number;
    totalDays: number;
  } {
    return {
      totalCost: stats.reduce((sum, stat) => sum + stat.totalCost, 0),
      totalTokens: stats.reduce((sum, stat) => sum + stat.totalTokens, 0),
      uniqueUsers: new Set(stats.map((stat) => stat.username)).size,
      totalDays: new Set(stats.map((stat) => stat.date)).size,
    };
  }
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
      // Find user - must exist
      const [user] = await tx.select().from(users).where(eq(users.username, username));

      if (!user) {
        throw new Error(`User not found: ${username}`);
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

  async getStatsForDateRange(
    startDate: Date,
    endDate: Date,
    username?: string,
    model?: string,
    tags?: string[],
  ): Promise<StatsResponse> {
    const startDateStr = format(startDate, "yyyy-MM-dd");
    const endDateStr = format(endDate, "yyyy-MM-dd");

    logger.info(`Querying stats from ${startDateStr} to ${endDateStr}`);

    // Build query conditions
    const conditions: SQL[] = [gte(usageStats.date, startDateStr), lte(usageStats.date, endDateStr)];

    if (username) {
      conditions.push(eq(users.username, username));
    }

    const hasMatchingUsers = await this.addTagsCondition(conditions, tags);
    if (!hasMatchingUsers) {
      return this.createEmptyStatsResponse("custom", startDate, endDate);
    }

    // Fetch stats data
    const statsResults = await this.fetchStatsData(conditions);

    // Process stats with model filtering
    const statsWithModels = await this.processStatsWithModels(statsResults, model);

    // Filter out null results (stats that don't have the requested model)
    const filteredStats = statsWithModels.filter((stat): stat is DailyStats => stat !== null);

    // Calculate summary
    const summary = this.calculateSummary(filteredStats);

    // Transform results for response
    return {
      period: "custom",
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      stats: filteredStats,
      summary,
    };
  }

  async getAllStats(username?: string, model?: string, tags?: string[]): Promise<StatsResponse> {
    logger.info(`Querying all stats`);

    // Build query conditions
    const conditions: SQL[] = [];
    if (username) {
      conditions.push(eq(users.username, username));
    }

    const hasMatchingUsers = await this.addTagsCondition(conditions, tags);
    if (!hasMatchingUsers) {
      return this.createEmptyStatsResponse("all");
    }

    // Fetch stats data
    const statsResults = await this.fetchStatsData(conditions);

    // Process stats with model filtering
    const statsWithModels = await this.processStatsWithModels(statsResults, model);

    // Filter out null results (stats that don't have the requested model)
    const filteredStats = statsWithModels.filter((stat): stat is DailyStats => stat !== null);

    // Calculate summary
    const summary = this.calculateSummary(filteredStats);

    // Transform results for response
    return {
      period: "all",
      startDate: filteredStats.length > 0 ? filteredStats[filteredStats.length - 1].date : new Date().toISOString(),
      endDate: new Date().toISOString(),
      stats: filteredStats,
      summary,
    };
  }
}
