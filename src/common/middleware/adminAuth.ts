import type { NextFunction, Request, Response } from "express";
import { pino } from "pino";
import { env } from "@/common/utils/envConfig";

const logger = pino({ name: "admin-auth" });

/**
 * Middleware to authenticate admin requests
 * Supports both session-based auth (for browser/dashboard) and API key auth (for programmatic access)
 *
 * Authentication methods (checked in order):
 * 1. Session cookie with isAdmin flag
 * 2. X-Admin-Key header with master API key
 */
export function authenticateAdmin(req: Request, res: Response, next: NextFunction): void {
  try {
    // Check session authentication first (for browser requests from admin dashboard)
    if (req.session?.isAdmin === true) {
      // Update last activity timestamp
      req.session.lastActivity = new Date();

      next();

      return;
    }

    // Check for admin API key
    const adminKey = env.ADMIN_API_KEY;

    if (!adminKey) {
      logger.error("ADMIN_API_KEY is not configured in environment variables");

      res.status(500).json({
        error: "Admin authentication is not configured",
      });

      return;
    }

    // Get API key from X-Admin-Key header (for programmatic access)
    const providedKey = req.headers["x-admin-key"] as string;

    if (!providedKey) {
      res.status(401).json({
        error: "Authentication required. Use session cookie or X-Admin-Key header",
      });

      return;
    }

    // Validate the admin API key (simple string comparison for admin key)
    if (providedKey !== adminKey) {
      logger.warn(`Invalid admin API key attempt from IP: ${req.ip}`);

      res.status(401).json({
        error: "Invalid admin API key",
      });

      return;
    }

    // Admin API key is valid, proceed to next middleware
    next();
  } catch (error) {
    logger.error(error, "Admin authentication failed");

    res.status(500).json({
      error: "Authentication failed",
    });
  }
}
