import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { z } from "zod";
import { GetUserByUsernameSchema, UserSchema } from "@/api/user/userModel";
import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { authenticateAdmin } from "@/common/middleware/adminAuth";
import { validateRequest } from "@/common/utils/httpHandlers";
import { userController } from "./userController";

export const userRegistry = new OpenAPIRegistry();
export const userRouter: Router = express.Router();

userRegistry.register("User", UserSchema);

// GET /admin/users - Get all users
userRegistry.registerPath({
	method: "get",
	path: "/admin/users",
	tags: ["Admin"],
	summary: "Get all users",
	description: "Retrieves all users from the database. Requires admin authentication.",
	security: [{ AdminKeyAuth: [] }],
	responses: createApiResponse(z.array(UserSchema), "Success"),
});

userRouter.get("/", authenticateAdmin, userController.getUsers);

// GET /admin/users/:username - Get user by username
userRegistry.registerPath({
	method: "get",
	path: "/admin/users/{username}",
	tags: ["Admin"],
	summary: "Get user by username",
	description: "Retrieves a user by their username. Requires admin authentication.",
	security: [{ AdminKeyAuth: [] }],
	request: { params: GetUserByUsernameSchema.shape.params },
	responses: createApiResponse(UserSchema, "Success"),
});

userRouter.get(
	"/:username",
	authenticateAdmin,
	validateRequest(GetUserByUsernameSchema),
	userController.getUserByUsername,
);
