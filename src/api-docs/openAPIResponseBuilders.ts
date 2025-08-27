import { StatusCodes } from "http-status-codes";
import type { z } from "zod";

import { ErrorResponseSchema } from "@/common/models/errorResponse";

export function createApiResponse(schema: z.ZodTypeAny, description: string, statusCode = StatusCodes.OK) {
  return {
    [statusCode]: {
      description,
      content: {
        "application/json": {
          schema,
        },
      },
    },
  };
}

export function createErrorApiResponse(description: string, statusCode: number) {
  return {
    [statusCode]: {
      description,
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  };
}

export function createApiResponseWithErrors(schema: z.ZodTypeAny, description: string, statusCode = StatusCodes.OK) {
  return {
    ...createApiResponse(schema, description, statusCode),
    ...createErrorApiResponse("Bad Request", StatusCodes.BAD_REQUEST),
    ...createErrorApiResponse("Internal Server Error", StatusCodes.INTERNAL_SERVER_ERROR),
  };
}

// Use if you want multiple responses for a single endpoint

// import { ResponseConfig } from '@asteasolutions/zod-to-openapi';
// import { ApiResponseConfig } from '@common/models/openAPIResponseConfig';
// export type ApiResponseConfig = {
//   schema: z.ZodTypeAny;
//   description: string;
//   statusCode: StatusCodes;
// };
// export function createApiResponses(configs: ApiResponseConfig[]) {
//   const responses: { [key: string]: ResponseConfig } = {};
//   configs.forEach(({ schema, description, statusCode }) => {
//     responses[statusCode] = {
//       description,
//       content: {
//         'application/json': {
//           schema: ServiceResponseSchema(schema),
//         },
//       },
//     };
//   });
//   return responses;
// }
