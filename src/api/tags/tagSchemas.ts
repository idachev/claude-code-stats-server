import { z } from "zod";
import {
  TAG_MAX_LENGTH,
  TAG_MIN_LENGTH,
  TAG_NAME_PATTERN,
  TagNameBaseSchema,
  TagNameSchema,
  UsernameSchema,
} from "@/common/schemas/validationSchemas";

// Re-export for backward compatibility
export { TAG_MIN_LENGTH, TAG_MAX_LENGTH, TAG_NAME_PATTERN, TagNameBaseSchema, TagNameSchema };

// Request body for assigning tags to a user
export const AssignTagsSchema = z.object({
  tags: z.array(TagNameBaseSchema),
});

export type AssignTagsDto = z.infer<typeof AssignTagsSchema>;

// Response schema for tag list
export const TagListSchema = z.array(z.string());

// Username parameter schema
export const UsernameParamSchema = z.object({
  username: UsernameSchema,
});

// Tag name parameter schema
export const TagNameParamSchema = z.object({
  tagName: TagNameBaseSchema,
});

// Combined params for delete endpoint
export const DeleteTagParamsSchema = z.object({
  username: UsernameSchema,
  tagName: TagNameBaseSchema,
});
