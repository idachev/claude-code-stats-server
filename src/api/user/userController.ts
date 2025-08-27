import type { Request, RequestHandler, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { pino } from "pino";

import { ApiKeyService } from "@/api/auth/apiKeyService";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, USERNAME_PATTERN } from "@/api/user/userModel";
import { userService } from "@/api/user/userService";
import { MAX_PAGE_LIMIT } from "@/common/schemas/validationSchemas";
import { createErrorResponse, handleServiceResponse } from "@/common/utils/httpHandlers";

const logger = pino({ name: "user-controller" });

class UserController {
  private apiKeyService: ApiKeyService;

  constructor() {
    this.apiKeyService = new ApiKeyService();
  }

  public getUsers: RequestHandler = async (req: Request, res: Response) => {
    // Extract query parameters for filtering and pagination
    const filters = {
      search: req.query.search as string | undefined,
      tags: req.query.tags
        ? Array.isArray(req.query.tags)
          ? (req.query.tags as string[])
          : [req.query.tags as string]
        : undefined,
      page: req.query.page ? Number.parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? Number.parseInt(req.query.limit as string, 10) : undefined,
      sortBy: req.query.sortBy as "username" | "createdAt" | "updatedAt" | undefined,
      order: req.query.order as "asc" | "desc" | undefined,
    };

    // Validate pagination parameters
    if (filters.page !== undefined && (Number.isNaN(filters.page) || filters.page < 1)) {
      const errorResponse = createErrorResponse("Invalid page number", StatusCodes.BAD_REQUEST);
      res.status(StatusCodes.BAD_REQUEST).json(errorResponse);
      return;
    }
    if (
      filters.limit !== undefined &&
      (Number.isNaN(filters.limit) || filters.limit < 1 || filters.limit > MAX_PAGE_LIMIT)
    ) {
      const errorResponse = createErrorResponse(
        `Invalid limit (must be between 1 and ${MAX_PAGE_LIMIT})`,
        StatusCodes.BAD_REQUEST,
      );
      res.status(StatusCodes.BAD_REQUEST).json(errorResponse);
      return;
    }

    const serviceResponse = await userService.findAll(filters);
    handleServiceResponse(serviceResponse, res);
  };

  public getUserByUsername: RequestHandler = async (req: Request, res: Response) => {
    const username = req.params.username as string;
    const serviceResponse = await userService.findByUsername(username);
    handleServiceResponse(serviceResponse, res);
  };

  public createUser: RequestHandler = async (req: Request, res: Response) => {
    try {
      const { username, tags: rawTags } = req.body;
      // Trim tag names and filter out empty strings since we're using TagNameBaseSchema without transform
      const tags = rawTags?.map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);

      // Validation is handled by Zod schema, but keeping basic checks for safety
      if (
        !username ||
        username.length < USERNAME_MIN_LENGTH ||
        username.length > USERNAME_MAX_LENGTH ||
        !USERNAME_PATTERN.test(username)
      ) {
        const errorResponse = createErrorResponse(
          `Invalid username. Must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters and contain only letters, numbers, dots, underscores, and hyphens.`,
          StatusCodes.BAD_REQUEST,
        );
        res.status(StatusCodes.BAD_REQUEST).json(errorResponse);
        return;
      }

      const apiKey = await this.apiKeyService.createUserWithApiKey(username, tags);

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

  public deactivateUser: RequestHandler = async (req: Request, res: Response) => {
    try {
      const username = req.params.username as string;

      // Check if user exists first
      const userResponse = await userService.findByUsername(username);
      if (!userResponse.success || !userResponse.responseObject) {
        const errorResponse = createErrorResponse("User not found", StatusCodes.NOT_FOUND);
        res.status(StatusCodes.NOT_FOUND).json(errorResponse);
        return;
      }

      // Deactivate user by setting isActive to false AND regenerating API key to invalidate the old one
      await this.apiKeyService.deactivateUser(username);

      logger.info(`User ${username} deactivated and API key invalidated`);

      res.status(StatusCodes.OK).json({
        message: `User ${username} has been deactivated. The API key has been regenerated and the old key is no longer valid.`,
      });
    } catch (error: unknown) {
      logger.error(error, "Failed to deactivate user");
      const errorResponse = createErrorResponse("Failed to deactivate user", StatusCodes.INTERNAL_SERVER_ERROR);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  };
}

export const userController = new UserController();
