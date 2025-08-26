import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import pino from "pino";
import { createErrorResponse } from "@/common/utils/httpHandlers";

const logger = pino({ name: "csrf-protection" });

/**
 * CSRF Protection Middleware
 *
 * Validates CSRF tokens for state-changing operations (POST, PUT, DELETE, PATCH)
 * to prevent Cross-Site Request Forgery attacks.
 *
 * How it works:
 * 1. For safe methods (GET, HEAD, OPTIONS), no validation is performed
 * 2. For API key authenticated requests, no CSRF validation is needed (API keys are CSRF-safe)
 * 3. For session-based authentication, validates the X-CSRF-Token header against the session token
 * 4. Returns 403 Forbidden if tokens don't match or are missing
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
	// Skip CSRF validation for safe HTTP methods
	const safeMethods = ["GET", "HEAD", "OPTIONS"];
	if (safeMethods.includes(req.method)) {
		next();
		return;
	}

	// Skip CSRF validation for API key authenticated requests
	// API keys are inherently CSRF-safe as they can't be automatically included by browsers
	if (req.headers["x-admin-key"]) {
		logger.debug(
			{
				method: req.method,
				path: req.path,
			},
			"Skipping CSRF validation for API key authenticated request",
		);
		next();
		return;
	}

	// Check if session exists and has a CSRF token
	if (!req.session?.csrfToken) {
		logger.warn(
			{
				method: req.method,
				path: req.path,
				ip: req.ip,
			},
			"CSRF validation failed: No session CSRF token",
		);

		const errorResponse = createErrorResponse(
			"CSRF validation failed: Session expired or invalid",
			StatusCodes.FORBIDDEN,
		);
		res.status(StatusCodes.FORBIDDEN).json(errorResponse);
		return;
	}

	// Get CSRF token from request header
	const requestToken = req.headers["x-csrf-token"] as string;

	if (!requestToken) {
		logger.warn(
			{
				method: req.method,
				path: req.path,
				ip: req.ip,
				hasSession: true,
			},
			"CSRF validation failed: No X-CSRF-Token header",
		);

		const errorResponse = createErrorResponse(
			"CSRF validation failed: Missing X-CSRF-Token header",
			StatusCodes.FORBIDDEN,
		);
		res.status(StatusCodes.FORBIDDEN).json(errorResponse);
		return;
	}

	// Validate token using constant-time comparison
	if (!constantTimeCompare(requestToken, req.session.csrfToken)) {
		logger.warn(
			{
				method: req.method,
				path: req.path,
				ip: req.ip,
				hasSession: true,
				hasRequestToken: true,
			},
			"CSRF validation failed: Token mismatch",
		);

		const errorResponse = createErrorResponse("CSRF validation failed: Invalid CSRF token", StatusCodes.FORBIDDEN);
		res.status(StatusCodes.FORBIDDEN).json(errorResponse);
		return;
	}

	// CSRF validation successful
	logger.debug(
		{
			method: req.method,
			path: req.path,
		},
		"CSRF validation successful",
	);

	next();
};

/**
 * Constant-time string comparison to prevent timing attacks
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
function constantTimeCompare(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}

	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}

	return result === 0;
}

/**
 * Middleware to regenerate CSRF token on successful authentication
 * Call this after successful login to ensure fresh CSRF tokens
 */
export const regenerateCsrfToken = (req: Request, _res: Response, next: NextFunction): void => {
	if (req.session) {
		// Use crypto.randomBytes for cryptographically secure random tokens
		const crypto = require("node:crypto");
		req.session.csrfToken = crypto.randomBytes(32).toString("hex");
		logger.debug({ path: req.path }, "CSRF token regenerated");
	}
	next();
};
