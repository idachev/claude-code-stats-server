import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

// Username validation constants
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 128;
export const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

// Tag validation constants
export const TAG_MIN_LENGTH = 2;
export const TAG_MAX_LENGTH = 64;
export const TAG_NAME_PATTERN = /^[0-9A-Za-z .\-_]+$/;

// Pagination constants
export const MAX_PAGE_LIMIT = 100;
export const DEFAULT_PAGE_LIMIT = 20;

// Reusable username validation schema
export const UsernameSchema = z
	.string()
	.min(USERNAME_MIN_LENGTH)
	.max(USERNAME_MAX_LENGTH)
	.regex(USERNAME_PATTERN)
	.openapi("Username");

// Schema for individual tag name (base without transform for OpenAPI)
export const TagNameBaseSchema = z
	.string()
	.min(TAG_MIN_LENGTH, `Tag name must be at least ${TAG_MIN_LENGTH} characters`)
	.max(TAG_MAX_LENGTH, `Tag name cannot exceed ${TAG_MAX_LENGTH} characters`)
	.regex(TAG_NAME_PATTERN, "Tag name can only contain letters, numbers, spaces, dots, hyphens, and underscores")
	.openapi("TagName");

// Schema with transform for runtime validation
export const TagNameSchema = TagNameBaseSchema.transform((val) => val.trim());
