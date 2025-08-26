import connectPgSimple from "connect-pg-simple";
import type { RequestHandler } from "express";
import session from "express-session";
import { Pool } from "pg";
import { pino } from "pino";
import { env } from "@/common/utils/envConfig";

const logger = pino({ name: "session-config" });

// Create PostgreSQL session store
const PgSession = connectPgSimple(session);

// Create a separate pool for sessions to avoid conflicts
const sessionPool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  max: env.SESSION_POOL_MAX,
  idleTimeoutMillis: env.SESSION_POOL_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.SESSION_POOL_CONNECTION_TIMEOUT_MS,
});

// Session configuration
export const sessionConfig: RequestHandler = session({
  store: new PgSession({
    pool: sessionPool,
    tableName: "admin_sessions",
    createTableIfMissing: false, // We manage the table via migrations
    pruneSessionInterval: 60, // Prune expired sessions every 60 seconds
  }),
  secret: env.SESSION_SECRET || "change-this-secret-in-production",
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiry on activity
  cookie: {
    secure: env.NODE_ENV === "production", // HTTPS only in production
    httpOnly: true, // Prevent XSS attacks
    sameSite: "strict", // CSRF protection
    maxAge: (env.ADMIN_SESSION_TIMEOUT_SECONDS || 900) * 1000, // Default 15 minutes
  },
  name: "admin.sid", // Custom session cookie name
});

// Extend Express session type to include our custom properties
declare module "express-session" {
  interface SessionData {
    isAdmin?: boolean;
    loginTime?: Date;
    lastActivity?: Date;
    csrfToken?: string;
    username?: string;
  }
}

// Close session pool on app shutdown
export const closeSessionPool = async (): Promise<void> => {
  try {
    await sessionPool.end();
    logger.info("Session pool closed");
  } catch (error) {
    logger.error(error as Error, "Error closing session pool");
    throw error;
  }
};
