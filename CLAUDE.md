# Technical Development Guide

**IMPORTANT**: Read README.md first for project overview and structure information.

## Critical Development Rules

### 1. Database Migrations
- **ALWAYS use `pnpm db:migrate`** for applying database changes (not `db:push`)
- This ensures production-like migration tracking and prevents schema drift
- Generate migrations with: `pnpm db:generate`
- Apply migrations with: `pnpm db:migrate`

### 2. OpenAPI/Swagger Registration
When adding new API endpoints, you MUST register them in Swagger:

1. Create a registry in your router file:
```typescript
export const yourRegistry = new OpenAPIRegistry();
```

2. Register each endpoint:
```typescript
yourRegistry.registerPath({
  method: "post",
  path: "/your-endpoint",
  tags: ["YourTag"],
  request: { /* schema */ },
  responses: createApiResponse(/* schema */, "Success"),
});
```

3. **CRITICAL**: Add your registry to `/src/api-docs/openAPIDocumentGenerator.ts`:
```typescript
import { yourRegistry } from "@/api/your/yourRouter";
// ...
const registry = new OpenAPIRegistry([
  healthRegistry, 
  userRegistry, 
  statsRegistry,
  yourRegistry  // ADD THIS
]);
```

### 3. ORM Choice - Drizzle
- This project uses **Drizzle ORM** (not TypeORM)
- Drizzle was chosen for better ESNext/ES modules support
- Schema definitions are in `/src/db/schema.ts`
- Database connection is in `/src/db/index.ts`

### 4. Database Schema Changes
1. Modify schema in `/src/db/schema.ts`
2. Generate migration: `pnpm db:generate`
3. Review generated SQL in `/drizzle/` directory
4. Apply migration: `pnpm db:migrate`

### 5. Adding New Services
1. Create service class in appropriate `/src/api/*/` directory
2. Use Drizzle's query builder for database operations
3. Import from `@/db/index` for database access:
```typescript
import { db, users, usageStats } from "@/db/index";
import { eq, and, gte } from "drizzle-orm";
```

### 6. Transaction Handling
Always use transactions for multi-table operations:
```typescript
await db.transaction(async (tx) => {
  // Your transactional operations
});
```

### 7. Environment Configuration
- Database config is in `.env` (copy from `.env.template`)
- Default PostgreSQL port: 9099 (not standard 5432)
- Database name: `claude_code_stats`

### 8. Testing Endpoints
After adding new endpoints:
1. Restart the server
2. The server runs on port 3000 (http://localhost:3000)
3. Check Swagger UI at http://localhost:3000/swagger
4. Verify your endpoints appear under correct tags
5. Test with the "Try it out" feature

### 9. Code Style and Formatting

#### Formatting Tools
We use a hybrid approach for code formatting:
- **Biome**: JavaScript/TypeScript files (fast, opinionated)
- **Prettier**: CSS files (when they exist)
- **JS-Beautify**: EJS template files (handles inline expressions correctly)

#### Why JS-Beautify for EJS?
Prettier's EJS plugin has parsing issues with inline expressions like `<%= query.period === 'week' ? 'selected' : '' %>`. JS-Beautify handles these correctly.

#### Code Style Guidelines
- Use TypeScript strict mode
- Follow existing patterns in the codebase
- Use ESNext module syntax (import/export)
- Don't add decorators (we removed TypeORM decorators)
- Use tabs for indentation (configured in all formatters)

### 10. Adding Dashboard Views

When creating new dashboard views:

1. **Create EJS templates** in `/src/views/`:
   - Layouts go in `/src/views/layouts/`
   - Partials go in `/src/views/partials/`
   - Main views go in `/src/views/`

2. **Create a view router** in `/src/api/views/`:
```typescript
import { Router } from "express";
import type { Request, Response } from "express";

export const viewRouter = Router();

viewRouter.get("/your-view", async (req: Request, res: Response) => {
  const data = await fetchYourData();
  res.render("your-view", { data });
});
```

3. **Register the router** in `/src/server.ts`:
```typescript
import { viewRouter } from "@/api/views/viewRouter";
app.use("/", viewRouter);
```

4. **Use the base layout** for consistent styling:
```ejs
<%- include('layouts/base', { 
  title: 'Your Page Title',
  body: include('partials/your-content', { data }) 
}) %>
```

### 11. Content Security Policy (CSP)

The CSP configuration is in `/src/common/middleware/helmetConfig.ts`. It allows:
- Tailwind CSS from CDN
- Chart.js from CDN
- Inline scripts (required for Chart.js)
- Inline styles (required for Tailwind)

### 12. Common Commands
```bash
# Development
pnpm start:dev          # Start dev server with hot reload on port 3000
pnpm build             # Build for production

# Database
pnpm db:generate       # Generate migration from schema changes
pnpm db:migrate        # Apply migrations to database
pnpm db:studio         # Open Drizzle Studio for database GUI

# Code Quality
pnpm check            # Run all formatters (Biome + Prettier + JS-Beautify)
pnpm format:all       # Format CSS and EJS files
pnpm format:css       # Format CSS files with Prettier (if any exist)
pnpm format:ejs       # Format EJS templates with JS-Beautify
pnpm test             # Run tests
```

## Project Structure

See README.md for detailed project structure and setup instructions.

## Troubleshooting

### Migration Issues
- If migration fails with "table already exists", the database wasn't cleaned properly
- Use `utils/docker-compose/cleanup-data.sh` to reset database
- Then run `pnpm db:migrate` again

### Swagger Not Showing Endpoints
- Check that your registry is imported in `openAPIDocumentGenerator.ts`
- Verify registry is added to the array in `new OpenAPIRegistry([...])`
- Restart the server after changes

### Database Connection Issues
- Verify PostgreSQL is running: `docker ps`
- Check `.env` has correct database credentials
- Default password is in `utils/docker-compose/docker-secrets/db-password`

### View/Dashboard Issues
- If charts don't load, check browser console for CSP violations
- Rate limiting is disabled in development mode (`start:dev`)
- EJS template errors will show in server logs
- Chart.js requires inline scripts to be allowed in CSP

### Formatting Issues
- If EJS formatting fails, ensure JS-Beautify is installed: `pnpm add -D js-beautify`
- CSS formatting only runs if CSS files exist in the project
- For EJS syntax errors, check that template tags are properly closed