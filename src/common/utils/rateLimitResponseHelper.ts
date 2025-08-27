import type { Request, Response } from "express";
import type { ErrorResponse } from "@/common/models/errorResponse";

/**
 * Creates appropriate rate limit response based on request type
 * Returns JSON error for API requests, HTML for dashboard requests
 */
export function handleRateLimitResponse(req: Request, res: Response): void {
  const isDashboardRequest = req.url.includes("/dashboard");

  if (isDashboardRequest) {
    // Return HTML for dashboard requests
    res.status(429).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rate Limit Exceeded</title>
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
          <h1>Too Many Requests</h1>
          <p>You have exceeded the rate limit.</p>
          <p>Please wait several minutes before trying again.</p>
        </div>
      </body>
      </html>
    `);
  } else {
    // Return JSON error response for API requests
    const errorResponse: ErrorResponse = {
      error: "Too many requests, please try again later.",
      timestamp: new Date().toISOString(),
      status: 429,
    };
    res.status(429).json(errorResponse);
  }
}
