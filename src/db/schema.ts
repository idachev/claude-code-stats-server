import { relations, sql } from "drizzle-orm";
import { date, decimal, index, integer, pgTable, serial, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { TAG_MAX_LENGTH } from "@/api/tags/tagSchemas";

// Users table
export const users = pgTable(
	"users",
	{
		id: serial("id").primaryKey(),
		username: varchar("username", { length: 128 }).notNull().unique(),
		apiKeyHash: varchar("api_key_hash", { length: 255 }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		usernameIdx: uniqueIndex("username_idx").on(table.username),
	}),
);

// Usage stats table
export const usageStats = pgTable(
	"usage_stats",
	{
		id: serial("id").primaryKey(),
		userId: integer("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		date: date("date").notNull(),
		totalTokens: integer("total_tokens").notNull().default(0),
		inputTokens: integer("input_tokens").notNull().default(0),
		outputTokens: integer("output_tokens").notNull().default(0),
		cacheCreationInputTokens: integer("cache_creation_input_tokens").notNull().default(0),
		cacheReadInputTokens: integer("cache_read_input_tokens").notNull().default(0),
		totalCost: decimal("total_cost", { precision: 10, scale: 4 }).notNull().default("0"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		userDateIdx: uniqueIndex("user_date_idx").on(table.userId, table.date),
		dateIdx: index("date_idx").on(table.date),
	}),
);

// Model usage table
export const modelUsage = pgTable(
	"model_usage",
	{
		id: serial("id").primaryKey(),
		usageStatsId: integer("usage_stats_id")
			.notNull()
			.references(() => usageStats.id, { onDelete: "cascade" }),
		model: varchar("model", { length: 100 }).notNull(),
		provider: varchar("provider", { length: 50 }).notNull(),
		inputTokens: integer("input_tokens").notNull().default(0),
		outputTokens: integer("output_tokens").notNull().default(0),
		cacheCreationInputTokens: integer("cache_creation_input_tokens").notNull().default(0),
		cacheReadInputTokens: integer("cache_read_input_tokens").notNull().default(0),
		cost: decimal("cost", { precision: 10, scale: 4 }).notNull().default("0"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		usageStatsModelIdx: index("usage_stats_model_idx").on(table.usageStatsId, table.model),
	}),
);

// Tags table
export const tags = pgTable(
	"tags",
	{
		id: serial("id").primaryKey(),
		userId: integer("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		name: varchar("name", { length: TAG_MAX_LENGTH }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		userIdIdx: index("idx_tags_user_id").on(table.userId),
		nameIdx: index("idx_tags_name").on(table.name),
		userIdNameIdx: index("idx_tags_user_id_name").on(table.userId, table.name),
		uniqueUserTagNameCi: uniqueIndex("unique_user_tag_name_ci").on(table.userId, sql`LOWER(${table.name})`),
	}),
);

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
	usageStats: many(usageStats),
	tags: many(tags),
}));

export const usageStatsRelations = relations(usageStats, ({ one, many }) => ({
	user: one(users, {
		fields: [usageStats.userId],
		references: [users.id],
	}),
	modelUsages: many(modelUsage),
}));

export const modelUsageRelations = relations(modelUsage, ({ one }) => ({
	usageStats: one(usageStats, {
		fields: [modelUsage.usageStatsId],
		references: [usageStats.id],
	}),
}));

export const tagsRelations = relations(tags, ({ one }) => ({
	user: one(users, {
		fields: [tags.userId],
		references: [users.id],
	}),
}));

// Export types for TypeScript
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UsageStats = typeof usageStats.$inferSelect;
export type NewUsageStats = typeof usageStats.$inferInsert;
export type ModelUsage = typeof modelUsage.$inferSelect;
export type NewModelUsage = typeof modelUsage.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
