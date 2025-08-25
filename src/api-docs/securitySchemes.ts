import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

/**
 * Registers security schemes for the OpenAPI documentation
 */
export function registerSecuritySchemes(registry: OpenAPIRegistry): void {
	// X-API-Key header for User API keys
	registry.registerComponent("securitySchemes", "ApiKeyAuth", {
		type: "apiKey",
		in: "header",
		name: "X-API-Key",
		description: "User API key authentication. Use format: ccs_<key>",
	});

	// X-Admin-Key header for Admin API key
	registry.registerComponent("securitySchemes", "AdminKeyAuth", {
		type: "apiKey",
		in: "header",
		name: "X-Admin-Key",
		description: "Admin API key authentication for managing user API keys",
	});

	// Basic Auth for Admin Dashboard
	registry.registerComponent("securitySchemes", "BasicAuth", {
		type: "http",
		scheme: "basic",
		description: "Basic Authentication for admin dashboard. Username: admin, Password: ADMIN_API_KEY value",
	});

	// Session Auth (cookie-based)
	registry.registerComponent("securitySchemes", "SessionAuth", {
		type: "apiKey",
		in: "cookie",
		name: "admin.sid",
		description: "Session cookie authentication for admin dashboard",
	});
}
