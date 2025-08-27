import rateLimit from "express-rate-limit";
import { env } from "@/common/utils/envConfig";
import { handleRateLimitResponse } from "@/common/utils/rateLimitResponseHelper";

/**
 * Rate limiter specifically for admin login attempts
 * More restrictive than general API rate limiting
 */
export const adminLoginRateLimiter = rateLimit({
  windowMs: env.ADMIN_RATE_LIMIT_WINDOW_MS,
  limit: env.ADMIN_RATE_LIMIT_MAX_REQUESTS,
  message: "Too many login attempts. Please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting in test and development environments
  skip: () => env.isTest || env.isDevelopment,
  // Disable the IPv6 validation when skipping in test or development
  validate: env.isTest || env.isDevelopment ? false : undefined,

  // Handler for when rate limit is exceeded
  handler: handleRateLimitResponse,
  // Store rate limit info in memory (default)
  // In production, consider using Redis for distributed rate limiting
});
