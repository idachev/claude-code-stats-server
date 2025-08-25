import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { pino } from "pino";
import { env } from "@/common/utils/envConfig";

const logger = pino({ name: "admin-dashboard-auth" });

/**
 * Basic Auth middleware for admin dashboard
 * Checks for Basic Auth header and validates against ADMIN_API_KEY
 * Creates session on successful authentication
 */
export const adminDashboardAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	// Check if already authenticated via session
	if (req.session?.isAdmin) {
		// Update last activity
		req.session.lastActivity = new Date();

		return next();
	}

	// Validate server configuration
	const adminApiKey = env.ADMIN_API_KEY;

	if (!adminApiKey) {
		logger.error("ADMIN_API_KEY not configured");

		res.status(500).send("Server configuration error");

		return;
	}

	// Check Basic Auth header
	const authHeader = req.headers.authorization;

	if (!authHeader || !authHeader.startsWith("Basic ")) {
		res.setHeader("WWW-Authenticate", 'Basic realm="Admin Dashboard"');

		res.status(401).send("Authentication required");

		return;
	}

	try {
		// Parse Basic Auth credentials
		const base64 = authHeader.split(" ")[1];

		const decoded = Buffer.from(base64, "base64").toString("utf-8");

		const [username, password] = decoded.split(":");

		// Validate credentials
		if (username === "admin" && password === adminApiKey) {
			// Regenerate session ID to prevent session fixation attacks
			req.session.regenerate((err) => {
				if (err) {
					logger.error(err, "Failed to regenerate session");

					res.status(500).send("Authentication error");

					return;
				}

				// Set session data
				req.session.isAdmin = true;
				req.session.loginTime = new Date();
				req.session.lastActivity = new Date();
				req.session.username = "admin";

				// Generate CSRF token for the session
				req.session.csrfToken = crypto.randomBytes(32).toString("hex");

				// Save session before proceeding
				req.session.save((saveErr) => {
					if (saveErr) {
						logger.error(saveErr, "Failed to save session");

						res.status(500).send("Authentication error");

						return;
					}

					logger.info({ username: "admin" }, "Admin authenticated successfully");

					next();
				});
			});
		} else {
			// Invalid credentials
			logger.warn({ username }, "Invalid admin login attempt");

			res.setHeader("WWW-Authenticate", 'Basic realm="Admin Dashboard"');

			res.status(401).send("Invalid credentials");
		}
	} catch (error) {
		logger.error(error as Error, "Error processing Basic Auth");

		res.status(400).send("Invalid authentication format");
	}
};
