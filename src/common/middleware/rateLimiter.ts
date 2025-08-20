import rateLimit from "express-rate-limit";

import { env } from "@/common/utils/envConfig";

const rateLimiter = rateLimit({
	legacyHeaders: true,
	limit: env.COMMON_RATE_LIMIT_MAX_REQUESTS,
	message: "Too many requests, please try again later.",
	standardHeaders: true,
	windowMs: 15 * 60 * env.COMMON_RATE_LIMIT_WINDOW_MS,
	// Skip rate limiting in test environment
	skip: () => env.isTest,
	// Disable the IPv6 validation when skipping in test
	validate: env.isTest ? false : undefined,
});

export default rateLimiter;
