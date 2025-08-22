import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Request, type Response, type Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { createApiResponseWithErrors, createErrorApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { authenticateAdmin } from "@/common/middleware/adminAuth";
import { createErrorResponse, validateRequest } from "@/common/utils/httpHandlers";
import {
	type AssignTagsDto,
	AssignTagsSchema,
	DeleteTagParamsSchema,
	TagListSchema,
	UserIdParamSchema,
} from "./tagSchemas";
import { TagService } from "./tagService";

export const tagRegistry = new OpenAPIRegistry();
export const tagRouter: Router = express.Router();

const tagService = new TagService();

// GET /admin/users/:userId/tags - Get tags for a specific user
tagRegistry.registerPath({
	method: "get",
	path: "/admin/users/{userId}/tags",
	tags: ["Admin", "Tags"],
	summary: "Get user tags",
	description: "Retrieve all tags assigned to a specific user",
	security: [{ AdminAuth: [] }],
	request: {
		params: UserIdParamSchema,
	},
	responses: createApiResponseWithErrors(TagListSchema, "User tags retrieved successfully"),
});

tagRouter.get(
	"/admin/users/:userId/tags",
	authenticateAdmin,
	validateRequest(z.object({ params: UserIdParamSchema })),
	async (req: Request, res: Response) => {
		try {
			const { userId } = req.params as { userId: string };
			const tags = await tagService.getUserTags(Number(userId));
			res.status(StatusCodes.OK).json(tags);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Failed to get user tags";
			const errorResponse = createErrorResponse(errorMessage, StatusCodes.INTERNAL_SERVER_ERROR);
			res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(errorResponse);
		}
	},
);

// POST /admin/users/:userId/tags - Assign/create tags for user
tagRegistry.registerPath({
	method: "post",
	path: "/admin/users/{userId}/tags",
	tags: ["Admin", "Tags"],
	summary: "Assign tags to user",
	description: "Assign new tags to a user (adds to existing tags)",
	security: [{ AdminAuth: [] }],
	request: {
		params: UserIdParamSchema,
		body: {
			content: {
				"application/json": {
					schema: AssignTagsSchema,
				},
			},
			description: "Tags to assign to the user",
			required: true,
		},
	},
	responses: {
		[StatusCodes.NO_CONTENT]: {
			description: "Tags assigned successfully",
		},
		...createErrorApiResponse("Bad Request", StatusCodes.BAD_REQUEST),
		...createErrorApiResponse("Unauthorized", StatusCodes.UNAUTHORIZED),
		...createErrorApiResponse("Internal Server Error", StatusCodes.INTERNAL_SERVER_ERROR),
	},
});

tagRouter.post(
	"/admin/users/:userId/tags",
	authenticateAdmin,
	validateRequest(
		z.object({
			params: UserIdParamSchema,
			body: AssignTagsSchema,
		}),
	),
	async (req: Request, res: Response) => {
		try {
			const { userId } = req.params as { userId: string };
			const { tags: newTags } = req.body as AssignTagsDto;

			// Get existing tags
			const existingTags = await tagService.getUserTags(Number(userId));

			// Create a map for case-insensitive duplicate checking
			// Keep the first occurrence of each tag (case-insensitive)
			const tagMap = new Map<string, string>();
			
			// Add existing tags first (they have priority)
			for (const tag of existingTags) {
				const key = tag.toLowerCase();
				if (!tagMap.has(key)) {
					tagMap.set(key, tag);
				}
			}
			
			// Add new tags only if they don't exist (case-insensitive)
			for (const tag of newTags) {
				const key = tag.toLowerCase();
				if (!tagMap.has(key)) {
					tagMap.set(key, tag);
				}
			}

			// Get unique tags from the map
			const allTags = Array.from(tagMap.values());

			// Set all tags
			await tagService.setUserTags(Number(userId), allTags);

			res.status(StatusCodes.NO_CONTENT).send();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Failed to assign tags";
			const statusCode =
				error instanceof Error && error.message.includes("cannot")
					? StatusCodes.BAD_REQUEST
					: StatusCodes.INTERNAL_SERVER_ERROR;
			const errorResponse = createErrorResponse(errorMessage, statusCode);
			res.status(statusCode).json(errorResponse);
		}
	},
);

// PUT /admin/users/:userId/tags - Replace all tags for user
tagRegistry.registerPath({
	method: "put",
	path: "/admin/users/{userId}/tags",
	tags: ["Admin", "Tags"],
	summary: "Replace user tags",
	description: "Replace all existing tags for a user with new ones",
	security: [{ AdminAuth: [] }],
	request: {
		params: UserIdParamSchema,
		body: {
			content: {
				"application/json": {
					schema: AssignTagsSchema,
				},
			},
			description: "New tags to replace existing ones",
			required: true,
		},
	},
	responses: {
		[StatusCodes.NO_CONTENT]: {
			description: "Tags replaced successfully",
		},
		...createErrorApiResponse("Bad Request", StatusCodes.BAD_REQUEST),
		...createErrorApiResponse("Unauthorized", StatusCodes.UNAUTHORIZED),
		...createErrorApiResponse("Internal Server Error", StatusCodes.INTERNAL_SERVER_ERROR),
	},
});

tagRouter.put(
	"/admin/users/:userId/tags",
	authenticateAdmin,
	validateRequest(
		z.object({
			params: UserIdParamSchema,
			body: AssignTagsSchema,
		}),
	),
	async (req: Request, res: Response) => {
		try {
			const { userId } = req.params as { userId: string };
			const { tags } = req.body as AssignTagsDto;

			await tagService.setUserTags(Number(userId), tags);

			res.status(StatusCodes.NO_CONTENT).send();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Failed to replace tags";
			const statusCode =
				error instanceof Error && error.message.includes("cannot")
					? StatusCodes.BAD_REQUEST
					: StatusCodes.INTERNAL_SERVER_ERROR;
			const errorResponse = createErrorResponse(errorMessage, statusCode);
			res.status(statusCode).json(errorResponse);
		}
	},
);

// DELETE /admin/users/:userId/tags/:tagName - Remove specific tag from user
tagRegistry.registerPath({
	method: "delete",
	path: "/admin/users/{userId}/tags/{tagName}",
	tags: ["Admin", "Tags"],
	summary: "Remove tag from user",
	description: "Remove a specific tag from a user",
	security: [{ AdminAuth: [] }],
	request: {
		params: DeleteTagParamsSchema,
	},
	responses: {
		[StatusCodes.NO_CONTENT]: {
			description: "Tag removed successfully",
		},
		...createErrorApiResponse("Bad Request", StatusCodes.BAD_REQUEST),
		...createErrorApiResponse("Unauthorized", StatusCodes.UNAUTHORIZED),
		...createErrorApiResponse("Internal Server Error", StatusCodes.INTERNAL_SERVER_ERROR),
	},
});

tagRouter.delete(
	"/admin/users/:userId/tags/:tagName",
	authenticateAdmin,
	validateRequest(z.object({ params: DeleteTagParamsSchema })),
	async (req: Request, res: Response) => {
		try {
			const { userId, tagName } = req.params as { userId: string; tagName: string };

			await tagService.removeTagFromUser(Number(userId), tagName);

			res.status(StatusCodes.NO_CONTENT).send();
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Failed to remove tag";
			const errorResponse = createErrorResponse(errorMessage, StatusCodes.INTERNAL_SERVER_ERROR);
			res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(errorResponse);
		}
	},
);
