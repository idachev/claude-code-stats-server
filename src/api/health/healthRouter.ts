import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Request, type Response, type Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { createApiResponseWithErrors } from "@/api-docs/openAPIResponseBuilders";
import { checkDatabaseHealth } from "@/db/index";

export const healthRegistry = new OpenAPIRegistry();
export const healthRouter: Router = express.Router();

const HealthStatusSchema = z.object({
  status: z.string(),
  database: z.boolean(),
  timestamp: z.string(),
});

healthRegistry.registerPath({
  method: "get",
  path: "/health",
  tags: ["Health"],
  responses: createApiResponseWithErrors(HealthStatusSchema, "Success"),
});

healthRouter.get("/", async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseHealth();
  const healthStatus = {
    status: dbHealth ? "ok" : "degraded",
    database: dbHealth,
    timestamp: new Date().toISOString(),
  };

  res.status(StatusCodes.OK).json(healthStatus);
});
