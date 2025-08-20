import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";

import { authRegistry } from "@/api/auth/authRouter";
import { healthRegistry } from "@/api/health/healthRouter";
import { statsRegistry } from "@/api/stats/statsRouter";
import { userRegistry } from "@/api/user/userRouter";
import { viewsRegistry } from "@/api/views/viewsRouter";
import { registerSecuritySchemes } from "./securitySchemes";

export type OpenAPIDocument = ReturnType<OpenApiGeneratorV3["generateDocument"]>;

export function generateOpenAPIDocument(): OpenAPIDocument {
	const registry = new OpenAPIRegistry([healthRegistry, userRegistry, statsRegistry, viewsRegistry, authRegistry]);

	// Register security schemes
	registerSecuritySchemes(registry);

	const generator = new OpenApiGeneratorV3(registry.definitions);

	return generator.generateDocument({
		openapi: "3.0.0",
		info: {
			version: "1.0.0",
			title: "Claude Code Stats API",
			description: "API for managing Claude Code usage statistics",
		},
		servers: [
			{
				url: "http://localhost:3000",
				description: "Development server",
			},
		],
		externalDocs: {
			description: "View the raw OpenAPI Specification in JSON format",
			url: "/swagger.json",
		},
		security: [],
	});
}
