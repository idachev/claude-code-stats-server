import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import {
	ApiKeyCheckResponseSchema,
	ApiKeyResponseSchema,
	CheckApiKeySchema,
	CreateUserSchema,
	DeactivateUserSchema,
	GetUserByUsernameSchema,
	GetUsersQuerySchema,
	RegenerateApiKeySchema,
	UserListResponseSchema,
	UserSchema,
} from "@/api/user/userModel";
import { createApiResponseWithErrors, createErrorApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { authenticateAdmin } from "@/common/middleware/adminAuth";
import { csrfProtection } from "@/common/middleware/csrfProtection";
import { validateRequest } from "@/common/utils/httpHandlers";
import { userController } from "./userController";

export const userRegistry = new OpenAPIRegistry();
export const userRouter: Router = express.Router();

userRegistry.register("User", UserSchema);
userRegistry.register("ApiKeyResponse", ApiKeyResponseSchema);
userRegistry.register("ApiKeyCheckResponse", ApiKeyCheckResponseSchema);
userRegistry.register("UserListResponse", UserListResponseSchema);

// GET /admin/users - Get all users with pagination and filtering
userRegistry.registerPath({
	method: "get",
	path: "/admin/users",
	tags: ["Admin"],
	summary: "Get all users with pagination and filtering",
	description:
		"Retrieves users from the database with optional search, tag filtering, and pagination. Requires admin authentication.",
	security: [{ AdminKeyAuth: [] }],
	request: {
		query: GetUsersQuerySchema,
	},
	responses: createApiResponseWithErrors(UserListResponseSchema, "Success"),
});

userRouter.get("/", authenticateAdmin, userController.getUsers);

// POST /admin/users - Create new user with API key
userRegistry.registerPath({
	method: "post",
	path: "/admin/users",
	tags: ["Admin"],
	summary: "Create new user with API key",
	description:
		"Creates a new user and generates an API key. Returns the raw API key which should be stored securely by the user. Requires admin authentication.",
	security: [{ AdminKeyAuth: [] }],
	request: {
		body: {
			content: {
				"application/json": {
					schema: CreateUserSchema.shape.body,
				},
			},
		},
	},
	responses: createApiResponseWithErrors(ApiKeyResponseSchema, "User created successfully"),
});

userRouter.post("/", authenticateAdmin, csrfProtection, validateRequest(CreateUserSchema), userController.createUser);

// GET /admin/users/:username - Get user by username
userRegistry.registerPath({
	method: "get",
	path: "/admin/users/{username}",
	tags: ["Admin"],
	summary: "Get user by username",
	description: "Retrieves a user by their username. Requires admin authentication.",
	security: [{ AdminKeyAuth: [] }],
	request: { params: GetUserByUsernameSchema.shape.params },
	responses: createApiResponseWithErrors(UserSchema, "Success"),
});

userRouter.get(
	"/:username",
	authenticateAdmin,
	validateRequest(GetUserByUsernameSchema),
	userController.getUserByUsername,
);

// POST /admin/users/:username/api-key/regenerate - Regenerate API key for user
userRegistry.registerPath({
	method: "post",
	path: "/admin/users/{username}/api-key/regenerate",
	tags: ["Admin"],
	summary: "Regenerate API key for user",
	description:
		"Regenerates the API key for an existing user. Returns the new raw API key which should be stored securely. The old key will be invalidated. Requires admin authentication.",
	security: [{ AdminKeyAuth: [] }],
	request: { params: RegenerateApiKeySchema.shape.params },
	responses: createApiResponseWithErrors(ApiKeyResponseSchema, "API key regenerated successfully"),
});

userRouter.post(
	"/:username/api-key/regenerate",
	authenticateAdmin,
	csrfProtection,
	validateRequest(RegenerateApiKeySchema),
	userController.regenerateApiKey,
);

// POST /admin/users/:username/api-key/check - Validate user's API key
userRegistry.registerPath({
	method: "post",
	path: "/admin/users/{username}/api-key/check",
	tags: ["Admin"],
	summary: "Validate user's API key",
	description:
		"Validates whether the provided API key is correct for the specified user. Requires admin authentication.",
	security: [{ AdminKeyAuth: [] }],
	request: {
		params: CheckApiKeySchema.shape.params,
		body: {
			content: {
				"application/json": {
					schema: CheckApiKeySchema.shape.body,
				},
			},
		},
	},
	responses: createApiResponseWithErrors(ApiKeyCheckResponseSchema, "API key validation result"),
});

userRouter.post(
	"/:username/api-key/check",
	authenticateAdmin,
	csrfProtection,
	validateRequest(CheckApiKeySchema),
	userController.checkApiKey,
);

// POST /admin/users/:username/deactivate - Deactivate user
userRegistry.registerPath({
	method: "post",
	path: "/admin/users/{username}/deactivate",
	tags: ["Admin"],
	summary: "Deactivate user",
	description:
		"Deactivates a user by regenerating their API key, effectively blocking access. The old API key becomes invalid immediately. In the future, this will also set an isActive flag. Requires admin authentication.",
	security: [{ AdminKeyAuth: [] }],
	request: { params: DeactivateUserSchema.shape.params },
	responses: {
		[StatusCodes.OK]: {
			description: "User deactivated successfully",
			content: {
				"application/json": {
					schema: z.object({
						message: z.string(),
					}),
				},
			},
		},
		...createErrorApiResponse("User not found", StatusCodes.NOT_FOUND),
		...createErrorApiResponse("Server error", StatusCodes.INTERNAL_SERVER_ERROR),
	},
});

userRouter.post(
	"/:username/deactivate",
	authenticateAdmin,
	csrfProtection,
	validateRequest(DeactivateUserSchema),
	userController.deactivateUser,
);
