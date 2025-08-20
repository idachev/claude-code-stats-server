import path from "node:path";
import cors from "cors";
import express, { type Express } from "express";
import { pino } from "pino";
import { healthRouter } from "@/api/health/healthRouter";
import { statsRouter } from "@/api/stats/statsRouter";
import { userRouter } from "@/api/user/userRouter";
import { viewsRouter } from "@/api/views/viewsRouter";
import { openAPIRouter } from "@/api-docs/openAPIRouter";
import errorHandler from "@/common/middleware/errorHandler";
import helmetConfig from "@/common/middleware/helmetConfig";
import rateLimiter from "@/common/middleware/rateLimiter";
import requestLogger from "@/common/middleware/requestLogger";
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

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(helmetConfig);
app.use(rateLimiter);

// Static files
app.use("/public", express.static(publicPath));

// Request logging
app.use(requestLogger);

// Routes
app.use("/health", healthRouter);
app.use("/claude-code-stats", statsRouter);
app.use("/users", userRouter);
app.use("/", viewsRouter); // Views for dashboard and other HTML pages

// Swagger UI
app.use(openAPIRouter);

// Error handlers
app.use(errorHandler());

export { app, logger };
