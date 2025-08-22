import { z } from "zod";

// Tag constraints
export const TAG_MIN_LENGTH = 2;
export const TAG_MAX_LENGTH = 64;

// Validation pattern for tag names: [0-9A-Za-z .-_]
export const TAG_NAME_PATTERN = /^[0-9A-Za-z .\-_]+$/;

// Schema for individual tag name
export const TagNameSchema = z
	.string()
	.min(TAG_MIN_LENGTH, `Tag name must be at least ${TAG_MIN_LENGTH} characters`)
	.max(TAG_MAX_LENGTH, `Tag name cannot exceed ${TAG_MAX_LENGTH} characters`)
	.regex(TAG_NAME_PATTERN, "Tag name can only contain letters, numbers, spaces, dots, hyphens, and underscores")
	.transform((val) => val.trim());

// Request body for assigning tags to a user
export const AssignTagsSchema = z.object({
	tags: z.array(TagNameSchema),
});

export type AssignTagsDto = z.infer<typeof AssignTagsSchema>;

// Response schema for tag list
export const TagListSchema = z.array(z.string());

// User ID parameter schema
export const UserIdParamSchema = z.object({
	userId: z.coerce.number().positive(),
});

// Tag name parameter schema
export const TagNameParamSchema = z.object({
	tagName: TagNameSchema,
});

// Combined params for delete endpoint
export const DeleteTagParamsSchema = z.object({
	userId: z.coerce.number().positive(),
	tagName: TagNameSchema,
});
