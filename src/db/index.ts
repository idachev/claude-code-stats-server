import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { pino } from "pino";
import { env } from "@/common/utils/envConfig";
import * as schema from "./schema";

const logger = pino({ name: "database" });

const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Create Drizzle instance with schema
export const db = drizzle(pool, { schema });

// Export schema for use in queries
export * from "./schema";

// Database health check
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const result = await pool.query("SELECT 1");
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    logger.error(error as Error, "Database health check failed");
    return false;
  }
};

// Initialize database connection
export const initializeDatabase = async (): Promise<void> => {
  try {
    // Test the connection
    await pool.query("SELECT 1");
    logger.info("Database connection established");
  } catch (error) {
    logger.error(error as Error, "Error initializing database");
    throw error;
  }
};

// Close database connection
export const closeDatabase = async (): Promise<void> => {
  try {
    await pool.end();
    logger.info("Database connection closed");
  } catch (error) {
    logger.error(error as Error, "Error closing database");
    throw error;
  }
};
