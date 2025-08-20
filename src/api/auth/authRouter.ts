import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Request, type Response, type Router } from "express";
import { pino } from "pino";
import { z } from "zod";
import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { authenticateAdmin } from "@/common/middleware/adminAuth";
import { validateRequest } from "@/common/utils/httpHandlers";
import { ApiKeyService } from "./apiKeyService";

const logger = pino({ name: "auth-router" });

export const authRegistry = new OpenAPIRegistry();
export const authRouter: Router = express.Router();

const apiKeyService = new ApiKeyService();

// Schema for API key generation request
const GenerateApiKeySchema = z.object({
	body: z.object({
		username: z
			.string()
			.min(3)
			.max(50)
			.regex(/^[a-zA-Z0-9._-]+$/),
	}),
});

// Schema for API key revocation request
const RevokeApiKeySchema = z.object({
	body: z.object({
		username: z
			.string()
			.min(3)
			.max(50)
			.regex(/^[a-zA-Z0-9._-]+$/),
	}),
});

// Register POST /admin/generate-api-key endpoint
authRegistry.registerPath({
	method: "post",
	path: "/admin/generate-api-key",
	tags: ["Admin"],
	summary: "Generate a new API key for a user",
	description:
		"Generates a new API key for the specified user. Returns the raw API key which should be stored securely by the user. Requires admin authentication.",
	security: [{ AdminKeyAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: GenerateApiKeySchema.shape.body,
				},
			},
		},
	},
	responses: createApiResponse(
		z.object({
			apiKey: z.string(),
			message: z.string(),
		}),
		"API key generated successfully",
	),
});

// Generate API key endpoint
authRouter.post(
	"/generate-api-key",
	authenticateAdmin,
	validateRequest(GenerateApiKeySchema),
	async (req: Request, res: Response) => {
		try {
			const { username } = req.body;

			// Generate new API key
			const apiKey = await apiKeyService.generateApiKey(username);

			res.json({
				apiKey,
				message: "API key generated successfully. Please store it securely as it won't be shown again.",
			});
		} catch (error: unknown) {
			logger.error(error, "Failed to generate API key");
			res.status(500).json({
				error: "Failed to generate API key",
			});
		}
	},
);

// Register POST /admin/revoke-api-key endpoint
authRegistry.registerPath({
	method: "post",
	path: "/admin/revoke-api-key",
	tags: ["Admin"],
	summary: "Revoke a user's API key",
	description:
		"Revokes the API key for the specified user, preventing further API access. Requires admin authentication.",
	security: [{ AdminKeyAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: RevokeApiKeySchema.shape.body,
				},
			},
		},
	},
	responses: createApiResponse(
		z.object({
			message: z.string(),
		}),
		"API key revoked successfully",
	),
});

// Revoke API key endpoint
authRouter.post(
	"/revoke-api-key",
	authenticateAdmin,
	validateRequest(RevokeApiKeySchema),
	async (req: Request, res: Response) => {
		try {
			const { username } = req.body;

			// Revoke API key
			await apiKeyService.revokeApiKey(username);

			res.json({
				message: "API key revoked successfully",
			});
		} catch (error: unknown) {
			logger.error(error, "Failed to revoke API key");
			res.status(500).json({
				error: "Failed to revoke API key",
			});
		}
	},
);

// Register GET /admin/check-api-key endpoint
authRegistry.registerPath({
	method: "get",
	path: "/admin/check-api-key",
	tags: ["Admin"],
	summary: "Check if a user has an API key",
	description: "Checks whether the specified user has an API key configured. Requires admin authentication.",
	security: [{ AdminKeyAuth: [] }],
	request: {
		query: z.object({
			username: z
				.string()
				.min(3)
				.max(50)
				.regex(/^[a-zA-Z0-9._-]+$/),
		}),
	},
	responses: createApiResponse(
		z.object({
			hasApiKey: z.boolean(),
		}),
		"API key status retrieved",
	),
});

// Check API key existence endpoint
authRouter.get(
	"/check-api-key",
	authenticateAdmin,
	validateRequest(z.object({ query: z.object({ username: z.string() }) })),
	async (req: Request, res: Response) => {
		try {
			const { username } = req.query as { username: string };

			// Check if user has API key
			const hasApiKey = await apiKeyService.hasApiKey(username);

			res.json({
				hasApiKey,
			});
		} catch (error: unknown) {
			logger.error(error, "Failed to check API key");
			res.status(500).json({
				error: "Failed to check API key status",
			});
		}
	},
);
