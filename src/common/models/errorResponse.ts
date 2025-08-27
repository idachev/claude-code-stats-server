import { z } from "zod";

export interface ErrorResponse {
  error: string;
  timestamp: string;
  status: number;
}

export const ErrorResponseSchema = z.object({
  error: z.string(),
  timestamp: z.string(),
  status: z.number(),
});
