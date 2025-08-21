// Type definitions for stats module

// Input types for upload endpoint
export interface ModelBreakdown {
	modelName?: string;
	provider?: string;
	inputTokens?: number;
	outputTokens?: number;
	cacheCreationTokens?: number;
	cacheReadTokens?: number;
	cost?: number;
}

export interface DailyUsage {
	date?: string;
	inputTokens?: number;
	outputTokens?: number;
	cacheCreationTokens?: number;
	cacheReadTokens?: number;
	totalTokens?: number;
	totalCost?: number;
	modelBreakdowns?: ModelBreakdown[];
}

export interface CCUsageData {
	daily: DailyUsage[];
}

// Output types for getStats endpoint
export interface ModelStats {
	name: string;
	provider: string;
	cost: number;
	inputTokens: number;
	outputTokens: number;
	cacheCreationInputTokens: number;
	cacheReadInputTokens: number;
}

export interface DailyStats {
	date: string;
	username: string;
	totalCost: number;
	totalTokens: number;
	inputTokens: number;
	outputTokens: number;
	cacheCreationInputTokens: number;
	cacheReadInputTokens: number;
	models: ModelStats[];
}

export interface StatsSummary {
	totalCost: number;
	totalTokens: number;
	uniqueUsers: number;
	totalDays: number;
}

export interface StatsResponse {
	period: "week" | "month" | "custom" | "all";
	startDate: string;
	endDate: string;
	stats: DailyStats[];
	summary?: StatsSummary;
}
