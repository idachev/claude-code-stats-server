import rateLimit from "express-rate-limit";

import { env } from "@/common/utils/envConfig";
import { handleRateLimitResponse } from "@/common/utils/rateLimitResponseHelper";

const rateLimiter = rateLimit({
  windowMs: env.COMMON_RATE_LIMIT_WINDOW_MS,
  limit: env.COMMON_RATE_LIMIT_MAX_REQUESTS,
  message: "Too many requests, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting in test and development environments
  skip: () => env.isTest || env.isDevelopment,
  // Disable the IPv6 validation when skipping in test or development
  validate: env.isTest || env.isDevelopment ? false : undefined,
  // Handler for when rate limit is exceeded
  handler: handleRateLimitResponse,
});

export default rateLimiter;
