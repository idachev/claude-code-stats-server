import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

// Schema for API responses (excludes apiKeyHash)
export const UserSchema = z.object({
	id: z.number(),
	username: z.string(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

// Input Validation for 'GET /admin/users/:username' endpoint
export const GetUserByUsernameSchema = z.object({
	params: z.object({
		username: z
			.string()
			.min(3)
			.max(50)
			.regex(/^[a-zA-Z0-9._-]+$/),
	}),
});
