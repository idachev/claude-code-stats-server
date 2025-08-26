import path from "node:path";
import cors from "cors";
import express, { type Express } from "express";
import { pino } from "pino";
import { healthRouter } from "@/api/health/healthRouter";
import { statsRouter } from "@/api/stats/statsRouter";
import { tagRouter } from "@/api/tags/tagRouter";
import { userRouter } from "@/api/user/userRouter";
import { adminViewRouter } from "@/api/views/adminViewRouter";
import { viewsRouter } from "@/api/views/viewsRouter";
import { openAPIRouter } from "@/api-docs/openAPIRouter";
import errorHandler from "@/common/middleware/errorHandler";
import helmetConfig from "@/common/middleware/helmetConfig";
import rateLimiter from "@/common/middleware/rateLimiter";
import requestLogger from "@/common/middleware/requestLogger";
import { sessionConfig } from "@/common/middleware/sessionConfig";
import { env } from "@/common/utils/envConfig";

const logger = pino({ name: "server start" });
const app: Express = express();

// Get the directory path of the current module
// Using process.cwd() and relative path from src to views
const viewsPath = path.join(process.cwd(), "src", "views");
const publicPath = path.join(process.cwd(), "src", "public");

// Configure EJS
app.set("view engine", "ejs");
app.set("views", viewsPath);

// Set the application to trust the reverse proxy (only in production)
// In test environment, we don't set trust proxy to avoid rate limiter warnings
if (env.isProduction) {
  app.set("trust proxy", true);
}

// Base middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmetConfig);

// Session middleware - must come before routes that need sessions
app.use(sessionConfig);

app.use(rateLimiter);

// Request logging
app.use(requestLogger);

// Parse allowed origins from environment variable
const allowedOrigins = env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN.split(",").map((origin) => origin.trim());

// Configure route-specific CORS policies

// 1. Public endpoints - open access, no credentials
const publicCorsOptions: cors.CorsOptions = {
  origin: true, // Allow all origins
  methods: ["GET", "HEAD"],
  credentials: false,
};

// 2. Static files - open access
app.use("/public", cors(publicCorsOptions), express.static(publicPath));

// 3. Health check - monitoring services need open access
app.use("/health", cors(publicCorsOptions), healthRouter);

// 4. API Documentation - allow configured origins but no credentials needed
app.use(
  "/swagger",
  cors({
    origin: allowedOrigins,
    methods: ["GET"],
    credentials: false,
  }),
);
app.use(openAPIRouter);

// 5. Stats API - authenticated data submission
const apiCorsOptions: cors.CorsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST"],
  credentials: true,
  allowedHeaders: ["Content-Type", "X-API-Key"],
  exposedHeaders: ["X-RateLimit-Remaining", "X-RateLimit-Reset"],
};
app.use("/claude-code-stats", cors(apiCorsOptions), statsRouter);

// 6. Admin routes - strictest control
const adminCorsOptions: cors.CorsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
  allowedHeaders: ["Content-Type", "X-Admin-Key", "X-CSRF-Token"],
  maxAge: 600, // 10 minutes preflight cache
};
// Admin routes - authentication and CSRF protection applied in individual routers
app.use("/admin/users", cors(adminCorsOptions), userRouter);

// 7. Dashboard and views - session-based access
const dashboardCorsOptions: cors.CorsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST"], // POST for form submissions
  credentials: true,
};
app.use("/", cors(dashboardCorsOptions), viewsRouter); // Views for dashboard
app.use("/", cors(dashboardCorsOptions), adminViewRouter); // Admin dashboard views
app.use("/", cors(adminCorsOptions), tagRouter); // Tag routes under /admin/users/:userId/tags

// Error handlers
app.use(errorHandler());

export { app, logger };
