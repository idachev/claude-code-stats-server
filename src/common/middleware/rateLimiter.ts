import rateLimit from "express-rate-limit";

import { env } from "@/common/utils/envConfig";

const rateLimiter = rateLimit({
  legacyHeaders: true,
  limit: env.COMMON_RATE_LIMIT_MAX_REQUESTS,
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  windowMs: env.COMMON_RATE_LIMIT_WINDOW_MS,
  // Skip rate limiting in test and development environments
  skip: () => env.isTest || env.isDevelopment,
  // Disable the IPv6 validation when skipping in test or development
  validate: env.isTest || env.isDevelopment ? false : undefined,
});

export default rateLimiter;
