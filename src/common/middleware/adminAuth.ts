import type { NextFunction, Request, Response } from "express";
import { pino } from "pino";
import { env } from "@/common/utils/envConfig";

const logger = pino({ name: "admin-auth" });

/**
 * Middleware to authenticate admin requests using a master API key
 * Expects API key in the X-Admin-Key header
 */
export function authenticateAdmin(req: Request, res: Response, next: NextFunction): void {
	try {
		const adminKey = env.ADMIN_API_KEY;

		if (!adminKey) {
			logger.error("ADMIN_API_KEY is not configured in environment variables");
			res.status(500).json({
				error: "Admin authentication is not configured",
			});
			return;
		}

		// Get API key from X-Admin-Key header
		const providedKey = req.headers["x-admin-key"] as string;

		if (!providedKey) {
			res.status(401).json({
				error: "Admin API key is required. Provide it in X-Admin-Key header",
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
