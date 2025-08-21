import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { z } from "zod";
import {
	ApiKeyCheckResponseSchema,
	ApiKeyResponseSchema,
	CheckApiKeySchema,
	CreateUserSchema,
	GetUserByUsernameSchema,
	RegenerateApiKeySchema,
	UserSchema,
} from "@/api/user/userModel";
import { createApiResponseWithErrors } from "@/api-docs/openAPIResponseBuilders";
import { authenticateAdmin } from "@/common/middleware/adminAuth";
import { validateRequest } from "@/common/utils/httpHandlers";
import { userController } from "./userController";

export const userRegistry = new OpenAPIRegistry();
export const userRouter: Router = express.Router();

userRegistry.register("User", UserSchema);
userRegistry.register("ApiKeyResponse", ApiKeyResponseSchema);
userRegistry.register("ApiKeyCheckResponse", ApiKeyCheckResponseSchema);

// GET /admin/users - Get all users
userRegistry.registerPath({
	method: "get",
	path: "/admin/users",
	tags: ["Admin"],
	summary: "Get all users",
	description: "Retrieves all users from the database. Requires admin authentication.",
	security: [{ AdminKeyAuth: [] }],
	responses: createApiResponseWithErrors(z.array(UserSchema), "Success"),
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

userRouter.post("/", authenticateAdmin, validateRequest(CreateUserSchema), userController.createUser);

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
	validateRequest(CheckApiKeySchema),
	userController.checkApiKey,
);
