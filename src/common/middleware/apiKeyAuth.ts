import type { NextFunction, Request, Response } from "express";
import { pino } from "pino";
import { ApiKeyService } from "@/api/auth/apiKeyService";

const logger = pino({ name: "api-key-auth" });
const apiKeyService = new ApiKeyService();

/**
 * Middleware to authenticate requests using API key
 * Expects API key in the X-API-Key header
 */
export async function authenticateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Get username from query parameter
    const username = req.query.username as string;

    if (!username) {
      res.status(400).json({
        error: "Username is required",
      });
      return;
    }

    // Get API key from X-API-Key header (Express normalizes headers to lowercase)
    const apiKey = req.headers["x-api-key"] as string;
    logger.debug(`Auth attempt for user: ${username}, API key present: ${!!apiKey}, API key length: ${apiKey?.length}`);

    if (!apiKey) {
      res.status(401).json({
        error: "API key is required. Provide it in X-API-Key header",
      });
      return;
    }

    // Validate the API key
    const isValid = await apiKeyService.validateApiKey(username, apiKey);

    if (!isValid) {
      logger.warn(`Invalid API key attempt for user: ${username}`);
      res.status(401).json({
        error: "Invalid API key",
      });
      return;
    }

    // API key is valid, proceed to next middleware
    next();
  } catch (error) {
    logger.error(error, "API key authentication failed");
    res.status(500).json({
      error: "Authentication failed",
    });
  }
}
