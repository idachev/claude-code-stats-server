import type { Request, RequestHandler, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { pino } from "pino";

import { ApiKeyService } from "@/api/auth/apiKeyService";
import { userService } from "@/api/user/userService";
import { createErrorResponse, handleServiceResponse } from "@/common/utils/httpHandlers";

const logger = pino({ name: "user-controller" });

class UserController {
	private apiKeyService: ApiKeyService;

	constructor() {
		this.apiKeyService = new ApiKeyService();
	}

	public getUsers: RequestHandler = async (_req: Request, res: Response) => {
		const serviceResponse = await userService.findAll();
		handleServiceResponse(serviceResponse, res);
	};

	public getUserByUsername: RequestHandler = async (req: Request, res: Response) => {
		const username = req.params.username as string;
		const serviceResponse = await userService.findByUsername(username);
		handleServiceResponse(serviceResponse, res);
	};

	public createUser: RequestHandler = async (req: Request, res: Response) => {
		try {
			const { username } = req.body;

			if (!username || username.length < 3 || username.length > 50 || !/^[a-zA-Z0-9._-]+$/.test(username)) {
				const errorResponse = createErrorResponse(
					"Invalid username. Must be 3-50 characters and contain only letters, numbers, dots, underscores, and hyphens.",
					StatusCodes.BAD_REQUEST,
				);
				res.status(StatusCodes.BAD_REQUEST).json(errorResponse);
				return;
			}

			const apiKey = await this.apiKeyService.createUserWithApiKey(username);

			res.status(StatusCodes.CREATED).json({
				username,
				apiKey,
				message: "User created successfully. Please store the API key securely as it won't be shown again.",
			});
		} catch (error: unknown) {
			if (error instanceof Error && error.message.includes("already exists")) {
				const errorResponse = createErrorResponse(error.message, StatusCodes.CONFLICT);
				res.status(StatusCodes.CONFLICT).json(errorResponse);
				return;
			}
			logger.error(error, "Failed to create user");
			const errorResponse = createErrorResponse("Failed to create user", StatusCodes.INTERNAL_SERVER_ERROR);
			res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(errorResponse);
		}
	};

	public regenerateApiKey: RequestHandler = async (req: Request, res: Response) => {
		try {
			const username = req.params.username as string;

			const apiKey = await this.apiKeyService.regenerateApiKey(username);

			res.status(StatusCodes.OK).json({
				username,
				apiKey,
				message: "API key regenerated successfully. Please store it securely as it won't be shown again.",
			});
		} catch (error: unknown) {
			if (error instanceof Error && error.message.includes("not found")) {
				const errorResponse = createErrorResponse(error.message, StatusCodes.NOT_FOUND);
				res.status(StatusCodes.NOT_FOUND).json(errorResponse);
				return;
			}
			logger.error(error, "Failed to regenerate API key");
			const errorResponse = createErrorResponse("Failed to regenerate API key", StatusCodes.INTERNAL_SERVER_ERROR);
			res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(errorResponse);
		}
	};

	public checkApiKey: RequestHandler = async (req: Request, res: Response) => {
		try {
			const username = req.params.username as string;
			const { apiKey } = req.body;

			if (!apiKey) {
				const errorResponse = createErrorResponse("API key is required", StatusCodes.BAD_REQUEST);
				res.status(StatusCodes.BAD_REQUEST).json(errorResponse);
				return;
			}

			const isValid = await this.apiKeyService.validateApiKey(username, apiKey);

			res.status(StatusCodes.OK).json({
				username,
				isValid,
			});
		} catch (error: unknown) {
			logger.error(error, "Failed to validate API key");
			const errorResponse = createErrorResponse("Failed to validate API key", StatusCodes.INTERNAL_SERVER_ERROR);
			res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(errorResponse);
		}
	};
}

export const userController = new UserController();
