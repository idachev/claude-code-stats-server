import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import type { ZodError, ZodSchema } from "zod";

import type { ErrorResponse } from "@/common/models/errorResponse";
import type { ServiceResponse } from "@/common/models/serviceResponse";

export const createErrorResponse = (message: string, statusCode: number): ErrorResponse => ({
  error: message,
  timestamp: new Date().toISOString(),
  status: statusCode,
});

export const handleServiceResponse = <T>(serviceResponse: ServiceResponse<T>, res: Response): void => {
  if (serviceResponse.success) {
    if (serviceResponse.responseObject === null) {
      res.status(StatusCodes.NO_CONTENT).send();
    } else {
      res.status(serviceResponse.statusCode).json(serviceResponse.responseObject);
    }
  } else {
    const errorResponse = createErrorResponse(serviceResponse.message, serviceResponse.statusCode);
    res.status(serviceResponse.statusCode).json(errorResponse);
  }
};

export const validateRequest = (schema: ZodSchema) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    await schema.parseAsync({ body: req.body, query: req.query, params: req.params });
    next();
  } catch (err) {
    const errors = (err as ZodError).errors.map((e) => {
      const fieldPath = e.path.length > 0 ? e.path.join(".") : "root";
      return `${fieldPath}: ${e.message}`;
    });

    const errorMessage =
      errors.length === 1
        ? `Invalid input: ${errors[0]}`
        : `Invalid input (${errors.length} errors): ${errors.join("; ")}`;

    const errorResponse = createErrorResponse(errorMessage, StatusCodes.BAD_REQUEST);
    res.status(StatusCodes.BAD_REQUEST).json(errorResponse);
  }
};
