import type { ErrorRequestHandler, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import { createErrorResponse } from "@/common/utils/httpHandlers";

const unexpectedRequest: RequestHandler = (_req, res) => {
  const errorResponse = createErrorResponse("Not Found", StatusCodes.NOT_FOUND);
  res.status(StatusCodes.NOT_FOUND).json(errorResponse);
};

const addErrorToRequestLog: ErrorRequestHandler = (err, _req, res, next) => {
  res.locals.err = err;
  next(err);
};

export default (): [RequestHandler, ErrorRequestHandler] => [unexpectedRequest, addErrorToRequestLog];
