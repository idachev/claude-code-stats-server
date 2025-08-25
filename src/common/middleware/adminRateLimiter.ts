import rateLimit from "express-rate-limit";
import { env } from "@/common/utils/envConfig";

/**
 * Rate limiter specifically for admin login attempts
 * More restrictive than general API rate limiting
 */
export const adminLoginRateLimiter = rateLimit({
	windowMs: env.ADMIN_RATE_LIMIT_WINDOW * 1000, // Convert seconds to milliseconds
	max: env.ADMIN_MAX_LOGIN_ATTEMPTS, // Limit each IP to N requests per window
	message: "Too many login attempts. Please try again later.",
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers

	// Handler for when rate limit is exceeded
	handler: (_req, res) => {
		res.status(429).send(`
			<!DOCTYPE html>
			<html>
			<head>
				<title>Too Many Attempts</title>
				<style>
					body { 
						font-family: system-ui, sans-serif; 
						display: flex; 
						justify-content: center; 
						align-items: center; 
						height: 100vh; 
						margin: 0;
						background: #f3f4f6;
					}
					.error-container {
						text-align: center;
						padding: 2rem;
						background: white;
						border-radius: 8px;
						box-shadow: 0 2px 4px rgba(0,0,0,0.1);
					}
					h1 { color: #dc2626; }
					p { color: #6b7280; margin-top: 1rem; }
				</style>
			</head>
			<body>
				<div class="error-container">
					<h1>Too Many Login Attempts</h1>
					<p>You have exceeded the maximum number of login attempts.</p>
					<p>Please wait ${Math.ceil(env.ADMIN_RATE_LIMIT_WINDOW / 60)} minutes before trying again.</p>
				</div>
			</body>
			</html>
		`);
	},

	// Skip rate limiting in test environment
	skip: () => env.isTest,

	// Store rate limit info in memory (default)
	// In production, consider using Redis for distributed rate limiting
});
