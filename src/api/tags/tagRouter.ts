import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Request, type Response, type Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { UserService } from "@/api/user/userService";
import { createApiResponseWithErrors, createErrorApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { authenticateAdmin } from "@/common/middleware/adminAuth";
import { csrfProtection } from "@/common/middleware/csrfProtection";
import { createErrorResponse, validateRequest } from "@/common/utils/httpHandlers";
import {
  type AssignTagsDto,
  AssignTagsSchema,
  DeleteTagParamsSchema,
  TagListSchema,
  UsernameParamSchema,
} from "./tagSchemas";
import { TagService } from "./tagService";

export const tagRegistry = new OpenAPIRegistry();
export const tagRouter: Router = express.Router();

const tagService = new TagService();
const userService = new UserService();

// GET /admin/users/:username/tags - Get tags for a specific user
tagRegistry.registerPath({
  method: "get",
  path: "/admin/users/{username}/tags",
  tags: ["Admin", "Tags"],
  summary: "Get user tags",
  description: "Retrieve all tags assigned to a specific user",
  security: [{ AdminAuth: [] }],
  request: {
    params: UsernameParamSchema,
  },
  responses: createApiResponseWithErrors(TagListSchema, "User tags retrieved successfully"),
});

tagRouter.get(
  "/admin/users/:username/tags",
  authenticateAdmin,
  validateRequest(z.object({ params: UsernameParamSchema })),
  async (req: Request, res: Response) => {
    try {
      const { username } = req.params as { username: string };

      const userResult = await userService.findByUsername(username);

      if (!userResult.success || !userResult.responseObject) {
        const errorResponse = createErrorResponse("User not found", StatusCodes.NOT_FOUND);

        return res.status(StatusCodes.NOT_FOUND).json(errorResponse);
      }

      const user = userResult.responseObject;

      const tags = await tagService.getUserTags(user.id);

      res.status(StatusCodes.OK).json(tags);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to get user tags";

      const errorResponse = createErrorResponse(errorMessage, StatusCodes.INTERNAL_SERVER_ERROR);

      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  },
);

// POST /admin/users/:username/tags - Assign/create tags for user
tagRegistry.registerPath({
  method: "post",
  path: "/admin/users/{username}/tags",
  tags: ["Admin", "Tags"],
  summary: "Assign tags to user",
  description: "Assign new tags to a user (adds to existing tags)",
  security: [{ AdminAuth: [] }],
  request: {
    params: UsernameParamSchema,
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
  "/admin/users/:username/tags",
  authenticateAdmin,
  csrfProtection,
  validateRequest(
    z.object({
      params: UsernameParamSchema,
      body: AssignTagsSchema,
    }),
  ),
  async (req: Request, res: Response) => {
    try {
      const { username } = req.params as { username: string };

      const { tags: newTags } = req.body as AssignTagsDto;

      const userResult = await userService.findByUsername(username);

      if (!userResult.success || !userResult.responseObject) {
        const errorResponse = createErrorResponse("User not found", StatusCodes.NOT_FOUND);

        return res.status(StatusCodes.NOT_FOUND).json(errorResponse);
      }

      const user = userResult.responseObject;

      // Get existing tags
      const existingTags = await tagService.getUserTags(user.id);

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
      await tagService.setUserTags(user.id, allTags);

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

// PUT /admin/users/:username/tags - Replace all tags for user
tagRegistry.registerPath({
  method: "put",
  path: "/admin/users/{username}/tags",
  tags: ["Admin", "Tags"],
  summary: "Replace user tags",
  description: "Replace all existing tags for a user with new ones",
  security: [{ AdminAuth: [] }],
  request: {
    params: UsernameParamSchema,
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
  "/admin/users/:username/tags",
  authenticateAdmin,
  csrfProtection,
  validateRequest(
    z.object({
      params: UsernameParamSchema,
      body: AssignTagsSchema,
    }),
  ),
  async (req: Request, res: Response) => {
    try {
      const { username } = req.params as { username: string };

      const { tags } = req.body as AssignTagsDto;

      const userResult = await userService.findByUsername(username);

      if (!userResult.success || !userResult.responseObject) {
        const errorResponse = createErrorResponse("User not found", StatusCodes.NOT_FOUND);

        return res.status(StatusCodes.NOT_FOUND).json(errorResponse);
      }

      const user = userResult.responseObject;

      await tagService.setUserTags(user.id, tags);

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

// DELETE /admin/users/:username/tags/:tagName - Remove specific tag from user
tagRegistry.registerPath({
  method: "delete",
  path: "/admin/users/{username}/tags/{tagName}",
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
  "/admin/users/:username/tags/:tagName",
  authenticateAdmin,
  csrfProtection,
  validateRequest(z.object({ params: DeleteTagParamsSchema })),
  async (req: Request, res: Response) => {
    try {
      const { username, tagName } = req.params as { username: string; tagName: string };

      const userResult = await userService.findByUsername(username);
      if (!userResult.success || !userResult.responseObject) {
        const errorResponse = createErrorResponse("User not found", StatusCodes.NOT_FOUND);
        return res.status(StatusCodes.NOT_FOUND).json(errorResponse);
      }
      const user = userResult.responseObject;

      await tagService.removeTagFromUser(user.id, tagName);

      res.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to remove tag";
      const errorResponse = createErrorResponse(errorMessage, StatusCodes.INTERNAL_SERVER_ERROR);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  },
);
