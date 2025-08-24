import { expect, test } from "@playwright/test";

test.describe("Claude Code Stats Sanity Tests", () => {
	const baseURL = "http://localhost:3000";
	const adminApiKey = process.env.ADMIN_API_KEY || "ccs_admin_change_this_in_production_12345678901234567890";

	test("Health endpoint returns correct structure", async ({ request }) => {
		const response = await request.get(`${baseURL}/health`);
		expect(response.ok()).toBeTruthy();

		const json = await response.json();
		expect(json).toHaveProperty("status");
		expect(json).toHaveProperty("database");
		expect(json).toHaveProperty("timestamp");
		expect(json.status).toBe("ok");
		expect(json.database).toBe(true);
	});

	test("Swagger documentation is available", async ({ page, request }) => {
		// First check that the Swagger JSON is available
		const swaggerJsonResponse = await request.get(`${baseURL}/swagger.json`);
		expect(swaggerJsonResponse.ok()).toBeTruthy();
		
		const swaggerJson = await swaggerJsonResponse.json();
		expect(swaggerJson).toHaveProperty("openapi");
		expect(swaggerJson).toHaveProperty("info");
		expect(swaggerJson.info.title).toContain("Claude Code Stats API");
		expect(swaggerJson).toHaveProperty("paths");
		
		// Then check the Swagger UI
		await page.goto(baseURL);  // Swagger UI is at the root

		// Wait for Swagger UI to load
		await page.waitForSelector(".swagger-ui", { timeout: 10000 });

		// Check if the title is present
		const title = await page.locator(".info .title").textContent();
		expect(title).toContain("Claude Code Stats API");

		// Check for key endpoints (use first() to handle multiple matches)
		await expect(page.locator('.opblock-summary-path:has-text("/health")')).toBeVisible();
		await expect(page.locator('.opblock-summary-path:has-text("/claude-code-stats")').first()).toBeVisible();
		await expect(page.locator('.opblock-summary-path:has-text("/admin/users")').first()).toBeVisible();
	});

	test("Dashboard loads with correct elements", async ({ page }) => {
		await page.goto(`${baseURL}/dashboard`);

		// Wait for the dashboard form to load
		await page.waitForSelector("#dashboardForm", { timeout: 10000 });

		// Check main title
		await expect(page.locator("h1")).toContainText("Stats");

		// Check for key filter elements
		await expect(page.locator("#periodSelect")).toBeVisible();
		await expect(page.locator("#metricSelect")).toBeVisible();
		await expect(page.locator("#groupBySelect")).toBeVisible();
	});

	test("Stats retrieval endpoint works", async ({ request }) => {
		// Retrieve data without authentication (public endpoint)
		const getResponse = await request.get(`${baseURL}/claude-code-stats?period=week`);
		expect(getResponse.ok()).toBeTruthy();

		const responseData = await getResponse.json();
		expect(responseData).toHaveProperty("period");
		expect(responseData).toHaveProperty("stats");
		expect(Array.isArray(responseData.stats)).toBe(true);
		expect(responseData).toHaveProperty("startDate");
		expect(responseData).toHaveProperty("endDate");
		expect(responseData).toHaveProperty("summary");

		// Check summary structure
		if (responseData.summary) {
			expect(responseData.summary).toHaveProperty("totalCost");
			expect(responseData.summary).toHaveProperty("totalTokens");
			expect(responseData.summary).toHaveProperty("uniqueUsers");
			expect(responseData.summary).toHaveProperty("totalDays");
		}
	});

	test("Dashboard filters work correctly", async ({ page }) => {
		await page.goto(`${baseURL}/dashboard`);
		await page.waitForSelector("#dashboardForm", { timeout: 10000 });

		// Test period filter
		const periodSelect = page.locator("#periodSelect");
		await periodSelect.selectOption("all");

		// Form should auto-submit on change due to JavaScript
		await page.waitForTimeout(1000);

		// Verify page still loads
		await expect(page.locator("#dashboardForm")).toBeVisible();

		// Test metric filter
		const metricSelect = page.locator("#metricSelect");
		await metricSelect.selectOption("cost");
		await page.waitForTimeout(1000);

		// Test group by filter
		const groupBySelect = page.locator("#groupBySelect");
		await groupBySelect.selectOption("model");
		await page.waitForTimeout(1000);

		// Verify page still has the form
		await expect(page.locator("#dashboardForm")).toBeVisible();
	});

	test("Stats upload requires authentication", async ({ request }) => {
		// Test without username parameter - should fail with 400
		const noUsernameResponse = await request.post(`${baseURL}/claude-code-stats`, {
			data: {
				daily: [],
			},
			headers: {
				"Content-Type": "application/json",
			},
		});
		expect(noUsernameResponse.status()).toBe(400);

		// Test with username but without API key - should fail with 401
		const noKeyResponse = await request.post(`${baseURL}/claude-code-stats?username=test-user`, {
			data: {
				daily: [],
			},
			headers: {
				"Content-Type": "application/json",
			},
		});
		expect(noKeyResponse.status()).toBe(401);

		// Test with username and invalid API key - should fail with 401
		const invalidResponse = await request.post(`${baseURL}/claude-code-stats?username=test-user`, {
			data: {
				daily: [],
			},
			headers: {
				"Content-Type": "application/json",
				"X-API-Key": "invalid-api-key",
			},
		});
		expect(invalidResponse.status()).toBe(401);
	});

	test("Admin endpoints require authentication", async ({ request }) => {
		// Test without admin key - should fail
		const noKeyResponse = await request.get(`${baseURL}/admin/users`);
		expect(noKeyResponse.status()).toBe(401);

		// Test with invalid admin key - should fail
		const invalidResponse = await request.get(`${baseURL}/admin/users`, {
			headers: {
				"X-Admin-Key": "invalid-admin-key",
			},
		});
		expect(invalidResponse.status()).toBe(401);

		// Test with valid admin key - should work
		const validResponse = await request.get(`${baseURL}/admin/users`, {
			headers: {
				"X-Admin-Key": adminApiKey,
			},
		});
		expect(validResponse.ok()).toBeTruthy();
	});

	test("Swagger UI Try it out functionality", async ({ page }) => {
		await page.goto(baseURL);  // Swagger UI is at the root
		await page.waitForSelector(".swagger-ui", { timeout: 10000 });

		// Expand the health endpoint using a more specific selector
		const healthEndpoint = page.locator('.opblock-tag-section').filter({ hasText: 'Health' }).locator('.opblock').first();
		await healthEndpoint.click();

		// Wait for the endpoint to expand
		await page.waitForTimeout(500);

		// Check if Try it out button is visible
		const tryItOutBtn = page.locator('.btn.try-out__btn').first();
		await expect(tryItOutBtn).toBeVisible();

		// Click Try it out
		await tryItOutBtn.click();

		// Wait for the execute button to appear
		await page.waitForTimeout(500);

		// Execute the request
		const executeBtn = page.locator('.btn.execute').first();
		await executeBtn.click();

		// Wait for response
		await page.waitForSelector('.responses-inner', { timeout: 10000 });

		// Verify successful response
		const responseCode = page.locator('.response .response-col_status').first();
		await expect(responseCode).toContainText("200");
	});
});
