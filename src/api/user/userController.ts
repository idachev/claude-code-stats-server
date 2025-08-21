import type { Request, RequestHandler, Response } from "express";
import { pino } from "pino";

import { ApiKeyService } from "@/api/auth/apiKeyService";
import { userService } from "@/api/user/userService";

const logger = pino({ name: "user-controller" });

class UserController {
	private apiKeyService: ApiKeyService;

	constructor() {
		this.apiKeyService = new ApiKeyService();
	}

	public getUsers: RequestHandler = async (_req: Request, res: Response) => {
		const serviceResponse = await userService.findAll();
		res.status(serviceResponse.statusCode).send(serviceResponse);
	};

	public getUserByUsername: RequestHandler = async (req: Request, res: Response) => {
		const username = req.params.username as string;
		const serviceResponse = await userService.findByUsername(username);
		res.status(serviceResponse.statusCode).send(serviceResponse);
	};

	public createUser: RequestHandler = async (req: Request, res: Response) => {
		try {
			const { username } = req.body;

			// Validate username format
			if (!username || username.length < 3 || username.length > 50 || !/^[a-zA-Z0-9._-]+$/.test(username)) {
				res.status(400).json({
					error:
						"Invalid username. Must be 3-50 characters and contain only letters, numbers, dots, underscores, and hyphens.",
				});
				return;
			}

			// Create new user with API key
			const apiKey = await this.apiKeyService.createUserWithApiKey(username);

			res.status(201).json({
				username,
				apiKey,
				message: "User created successfully. Please store the API key securely as it won't be shown again.",
			});
		} catch (error: unknown) {
			if (error instanceof Error && error.message.includes("already exists")) {
				res.status(409).json({
					error: error.message,
				});
				return;
			}
			logger.error(error, "Failed to create user");
			res.status(500).json({
				error: "Failed to create user",
			});
		}
	};

	public regenerateApiKey: RequestHandler = async (req: Request, res: Response) => {
		try {
			const username = req.params.username as string;

			// Regenerate API key for existing user
			const apiKey = await this.apiKeyService.regenerateApiKey(username);

			res.json({
				username,
				apiKey,
				message: "API key regenerated successfully. Please store it securely as it won't be shown again.",
			});
		} catch (error: unknown) {
			if (error instanceof Error && error.message.includes("not found")) {
				res.status(404).json({
					error: error.message,
				});
				return;
			}
			logger.error(error, "Failed to regenerate API key");
			res.status(500).json({
				error: "Failed to regenerate API key",
			});
		}
	};

	public checkApiKey: RequestHandler = async (req: Request, res: Response) => {
		try {
			const username = req.params.username as string;
			const { apiKey } = req.body;

			if (!apiKey) {
				res.status(400).json({
					error: "API key is required",
				});
				return;
			}

			// Validate the API key for the user
			const isValid = await this.apiKeyService.validateApiKey(username, apiKey);

			res.json({
				username,
				isValid,
			});
		} catch (error: unknown) {
			logger.error(error, "Failed to validate API key");
			res.status(500).json({
				error: "Failed to validate API key",
			});
		}
	};
}

export const userController = new UserController();
