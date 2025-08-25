import { z } from "zod";
import {
	TagNameBaseSchema,
	USERNAME_MAX_LENGTH,
	USERNAME_MIN_LENGTH,
	USERNAME_PATTERN,
	UsernameSchema,
} from "@/common/schemas/validationSchemas";

// Re-export for backward compatibility
export { USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, USERNAME_PATTERN, UsernameSchema };

// Schema for API responses (excludes apiKeyHash)
export const UserSchema = z.object({
	id: z.number(),
	username: z.string(),
	tags: z.array(z.string()),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

// Input Validation for 'GET /admin/users/:username' endpoint
export const GetUserByUsernameSchema = z.object({
	params: z.object({
		username: UsernameSchema,
	}),
});

// Input Validation for 'POST /admin/users' endpoint
export const CreateUserSchema = z.object({
	body: z.object({
		username: UsernameSchema,
		tags: z.array(TagNameBaseSchema).optional(), // Optional array of tags
	}),
});

// Input Validation for 'POST /admin/users/:username/api-key/regenerate' endpoint
export const RegenerateApiKeySchema = z.object({
	params: z.object({
		username: UsernameSchema,
	}),
});

// Input Validation for 'POST /admin/users/:username/api-key/check' endpoint
export const CheckApiKeySchema = z.object({
	params: z.object({
		username: UsernameSchema,
	}),
	body: z.object({
		apiKey: z.string().min(1),
	}),
});

// Input Validation for 'POST /admin/users/:username/deactivate' endpoint
export const DeactivateUserSchema = z.object({
	params: z.object({
		username: UsernameSchema,
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
