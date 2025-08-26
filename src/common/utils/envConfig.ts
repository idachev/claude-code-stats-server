import * as dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),

  HOST: z.string().min(1).default("localhost"),

  PORT: z.coerce.number().int().positive().default(8080),

  // CORS_ORIGIN can be:
  // - A single URL: "http://localhost:3000"
  // - Multiple URLs separated by commas: "http://localhost:3000,https://example.com"
  // - Wildcard "*" to allow all origins (use with caution in production)
  CORS_ORIGIN: z.string().min(1).default("http://localhost:8080"),

  COMMON_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(1000),

  COMMON_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(1000),

  // Database configuration
  DB_HOST: z.string().min(1).default("localhost"),
  DB_PORT: z.coerce.number().int().positive().default(9099),
  DB_NAME: z.string().min(1).default("claude_code_stats"),
  DB_USER: z.string().min(1).default("localdev"),
  DB_PASSWORD: z.string().min(1).default("localdev"),

  // Admin authentication
  ADMIN_API_KEY: z.string().min(1).optional(),

  // Session configuration
  SESSION_SECRET: z.string().min(32).optional(),
  ADMIN_SESSION_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(900), // 15 minutes in seconds
  ADMIN_MAX_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
  ADMIN_RATE_LIMIT_WINDOW: z.coerce.number().int().positive().default(900), // 15 minutes in seconds

  // Session pool configuration
  SESSION_POOL_MAX: z.coerce.number().int().positive().default(10),
  SESSION_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000), // 30 seconds
  SESSION_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(30000), // 30 seconds as requested
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.format());
  throw new Error("Invalid environment variables");
}

export const env = {
  ...parsedEnv.data,
  isDevelopment: parsedEnv.data.NODE_ENV === "development",
  isProduction: parsedEnv.data.NODE_ENV === "production",
  isTest: parsedEnv.data.NODE_ENV === "test",
};
