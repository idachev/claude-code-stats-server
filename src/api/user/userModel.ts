import { z } from "zod";
import {
  MAX_PAGE_LIMIT,
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
  isActive: z.boolean(),
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

// Pagination schema
export const PaginationSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(MAX_PAGE_LIMIT),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

// Filters schema for user list
export const UserFiltersSchema = z.object({
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// Response schema for paginated user list
export const UserListResponseSchema = z.object({
  users: z.array(UserSchema),
  pagination: PaginationSchema,
  filters: UserFiltersSchema,
});

// Query parameters schema for GET /admin/users
export const GetUsersQuerySchema = z.object({
  search: z.string().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  sortBy: z.enum(["username", "createdAt", "updatedAt"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
});
