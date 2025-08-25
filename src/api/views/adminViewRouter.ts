import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { type Router as ExpressRouter, type Request, type Response, Router } from "express";
import { StatusCodes } from "http-status-codes";
import { pino } from "pino";
import { z } from "zod";
import { TagService } from "@/api/tags/tagService";
import { userService } from "@/api/user/userService";
import { adminDashboardAuth } from "@/common/middleware/adminDashboardAuth";
import { adminLoginRateLimiter } from "@/common/middleware/adminRateLimiter";

const tagService = new TagService();

const logger = pino({ name: "admin-view-router" });

export const adminViewRouter: ExpressRouter = Router();
export const adminViewRegistry = new OpenAPIRegistry();

// Register OpenAPI documentation for admin dashboard
adminViewRegistry.registerPath({
	method: "get",
	path: "/dashboard/admin",
	tags: ["Admin Dashboard"],
	summary: "Admin Dashboard",
	description: "Access the admin dashboard for user management. Requires Basic Authentication with admin credentials.",
	security: [{ BasicAuth: [] }],
	responses: {
		[StatusCodes.OK]: {
			description: "Admin dashboard HTML page",
			content: {
				"text/html": {
					schema: z.string(),
				},
			},
		},
		[StatusCodes.UNAUTHORIZED]: {
			description: "Authentication required",
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: "Too many login attempts",
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: "Server error",
		},
	},
});

/**
 * GET /dashboard/admin
 * Render admin dashboard with initial data
 * Protected by Basic Auth + Session + Rate Limiting
 */
adminViewRouter.get(
	"/dashboard/admin",
	adminLoginRateLimiter, // Apply rate limiting first
	adminDashboardAuth, // Then check authentication
	async (req: Request, res: Response) => {
		try {
			// Load initial data using internal services (no API calls)
			const [usersResponse, tagsList] = await Promise.all([userService.findAll(), tagService.getTags()]);

			// Extract user data from service response
			const userData = usersResponse.success && usersResponse.responseObject ? usersResponse.responseObject : [];
			const tagData = tagsList || [];

			// Render admin dashboard with initial data
			res.render("dashboard/admin", {
				title: "Admin Dashboard",
				initialData: {
					users: userData,
					tags: tagData,
					csrfToken: req.session.csrfToken,
					sessionTimeout: parseInt(process.env.ADMIN_SESSION_TIMEOUT || "900"),
				},
			});
		} catch (error) {
			logger.error(error as Error, "Failed to load admin dashboard");
			res.status(500).send("Failed to load admin dashboard");
		}
	},
);

// Register OpenAPI documentation for logout endpoint
adminViewRegistry.registerPath({
	method: "post",
	path: "/admin/logout",
	tags: ["Admin Dashboard"],
	summary: "Logout from admin dashboard",
	description: "Destroy the admin session and clear session cookie.",
	security: [{ SessionAuth: [] }],
	responses: {
		[StatusCodes.OK]: {
			description: "Logout successful",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						message: z.string(),
					}),
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: "Failed to logout",
			content: {
				"application/json": {
					schema: z.object({
						error: z.string(),
					}),
				},
			},
		},
	},
});

/**
 * POST /admin/logout
 * Destroy admin session and redirect to login
 */
adminViewRouter.post("/admin/logout", (req: Request, res: Response) => {
	const username = req.session?.username || "unknown";

	// Destroy the session
	req.session.destroy((err) => {
		if (err) {
			logger.error(err, "Failed to destroy session");
			return res.status(500).json({ error: "Failed to logout" });
		}

		// Clear the session cookie
		res.clearCookie("admin.sid");

		logger.info({ username }, "Admin logged out successfully");

		// Return success response for AJAX requests
		res.json({ success: true, message: "Logged out successfully" });
	});
});

// Register OpenAPI documentation for GET logout endpoint
adminViewRegistry.registerPath({
	method: "get",
	path: "/admin/logout",
	tags: ["Admin Dashboard"],
	summary: "Logout via GET (redirect)",
	description: "Alternative logout endpoint that destroys session and redirects to main dashboard.",
	security: [{ SessionAuth: [] }],
	responses: {
		[StatusCodes.MOVED_TEMPORARILY]: {
			description: "Redirect to main dashboard after logout",
		},
	},
});

/**
 * GET /admin/logout
 * Alternative logout endpoint for direct navigation
 * Destroy admin session and redirect to dashboard
 */
adminViewRouter.get("/admin/logout", (req: Request, res: Response) => {
	const username = req.session?.username || "unknown";

	// Destroy the session
	req.session.destroy((err) => {
		if (err) {
			logger.error(err, "Failed to destroy session");
			// Even if destroy fails, clear cookie and redirect
		}

		// Clear the session cookie
		res.clearCookie("admin.sid");

		logger.info({ username }, "Admin logged out successfully");

		// Redirect to main dashboard or home
		res.redirect("/dashboard");
	});
});
