import * as dotenv from "dotenv";
import type { Config } from "drizzle-kit";

dotenv.config();

export default {
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		host: process.env.DB_HOST || "localhost",
		port: parseInt(process.env.DB_PORT || "9099"),
		user: process.env.DB_USER || "localdev",
		password: process.env.DB_PASSWORD || "db-test-pass",
		database: process.env.DB_NAME || "claude_code_stats",
		ssl: false,
	},
	migrations: {
		table: "__drizzle_migrations",
		schema: "public", // Move migrations table to public schema
	},
	verbose: true,
	strict: true,
} satisfies Config;
