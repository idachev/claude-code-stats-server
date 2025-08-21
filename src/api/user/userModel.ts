import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

// Username validation constants
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 128;
export const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

// Reusable username validation schema
export const UsernameValidation = z.string().min(USERNAME_MIN_LENGTH).max(USERNAME_MAX_LENGTH).regex(USERNAME_PATTERN);

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
		username: UsernameValidation,
	}),
});

// Input Validation for 'POST /admin/users' endpoint
export const CreateUserSchema = z.object({
	body: z.object({
		username: UsernameValidation,
	}),
});

// Input Validation for 'POST /admin/users/:username/api-key/regenerate' endpoint
export const RegenerateApiKeySchema = z.object({
	params: z.object({
		username: UsernameValidation,
	}),
});

// Input Validation for 'POST /admin/users/:username/api-key/check' endpoint
export const CheckApiKeySchema = z.object({
	params: z.object({
		username: UsernameValidation,
	}),
	body: z.object({
		apiKey: z.string().min(1),
	}),
});

// Response schema for API key operations
export const ApiKeyResponseSchema = z.object({
	username: z.string(),
	apiKey: z.string(),
	message: z.string(),
});

// Response schema for API key validation
export const ApiKeyCheckResponseSchema = z.object({
	username: z.string(),
	isValid: z.boolean(),
});
