import { sql } from "drizzle-orm";
import { db } from "@/db/index";

/**
 * Cleans up all test data from the database by truncating all tables.
 * This ensures complete isolation between test runs.
 * Tables are truncated in order respecting foreign key constraints.
 */
export async function cleanupTestDatabase(): Promise<void> {
  try {
    await db.execute(sql`
			-- Disable foreign key checks temporarily for cleanup
			SET session_replication_role = 'replica';

			-- Truncate all tables in correct order (respecting foreign keys)
			TRUNCATE TABLE model_usage CASCADE;
			TRUNCATE TABLE usage_stats CASCADE;
			TRUNCATE TABLE tags CASCADE;
			TRUNCATE TABLE users CASCADE;

			-- Re-enable foreign key checks
			SET session_replication_role = 'origin';
		`);
  } catch (error) {
    console.error("Failed to cleanup test database:", error);
    throw error;
  }
}
