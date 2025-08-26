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
  responses: createApiResponseWithErrors(/* schema */, "Success"),
});
// Or for custom error responses:
responses: {
  [StatusCodes.NO_CONTENT]: { description: "Success" },
  ...createErrorApiResponse("Bad Request", StatusCodes.BAD_REQUEST),
}
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

### 12. Testing Philosophy

**IMPORTANT: Do NOT mock the database in tests**
- Use real database connections for integration tests
- Database mocks hide critical issues with:
  - Schema mismatches
  - Index performance
  - Transaction behavior
  - Constraint violations
  - SQL syntax errors
- Tests should use a test database or transactions that rollback
- This ensures tests catch real database-related bugs

### 13. Getting PR Review Comments with GitHub CLI

To get inline review comments on a pull request:
```bash
# Get all review comments (inline/diff comments) with pagination
gh api repos/{owner}/{repo}/pulls/{pull_number}/comments --paginate

# Example for this repository:
gh api repos/idachev/claude-code-stats-server/pulls/1/comments --paginate

# Format the output to see specific fields:
gh api repos/{owner}/{repo}/pulls/{pull_number}/comments --paginate \
  --jq '.[] | {path: .path, line: .line, body: .body, user: .user.login}'
```

### 14. Docker & Database Migrations

The Docker image now includes migration capabilities. The same image can be used for both:
- Running the application (default)
- Executing database migrations (by overriding the command)

See `docker-compose-all.yaml` for an example setup with automatic migrations.

### 15. Admin Dashboard & Session Management

The admin dashboard provides user management capabilities:
- **Route**: `/dashboard/admin` (session-protected)
- **Authentication**: Session-based using express-session with PostgreSQL store
- **Features**: User CRUD, tag management, soft deletes (deactivation)

Key architectural patterns:
- Separate middleware for API auth (`adminAuth.ts`) vs dashboard auth (`adminDashboardAuth.ts`)
- Sessions stored in PostgreSQL using `connect-pg-simple`
- Validation schemas centralized in `/src/common/schemas/validationSchemas.ts`

### 16. HTML Template Management

**IMPORTANT: Keep HTML templates separate from JavaScript code**

When building client-side UI components, avoid embedding HTML strings directly in JavaScript. Instead:

1. **Use EJS Partials** for server-rendered components:
```javascript
// Good - Use separate EJS partial files
<%- include('partials/admin/user-row', { user }) %>

// Bad - HTML strings in JavaScript
const html = `<tr><td>${user.name}</td></tr>`;
```

2. **Use HTML `<template>` Elements** for client-side templates:
```html
<!-- Define template in HTML -->
<template id="userRowTemplate">
  <tr class="user-row">
    <td class="username"></td>
    <td class="tags"></td>
  </tr>
</template>
```

3. **Create a Template Loader** for managing templates:
```javascript
// Centralized template management
class TemplateLoader {
  renderUserRow(user) {
    // Use template or generate from structured data
  }
}
```

4. **Benefits of Separation**:
- Better IDE support (syntax highlighting, autocomplete)
- Easier maintenance and debugging
- Reusable templates across components
- Clear separation of concerns
- Better performance through template caching

5. **File Organization**:
```
src/views/partials/admin/  # Server-side EJS partials
  user-row.ejs
  pagination.ejs
  modal.ejs

src/public/js/             # Client-side JavaScript
  template-loader.js       # Template management
  admin-ui-manager.js      # UI logic (no HTML strings)
```

### 17. Admin Dashboard Architecture

The admin dashboard follows a modular JavaScript architecture:

1. **Separation of Concerns**:
   - API communication (AdminApiClient)
   - UI state management (AdminUIManager)
   - Template rendering (TemplateLoader)
   - Loading/error handling (LoadingManager)

2. **Security Features**:
   - CSRF protection on all mutations
   - Session-based authentication with timeout
   - XSS prevention through HTML escaping
   - Secure API key display with copy functionality

3. **Performance Optimizations**:
   - Debounced search (300ms delay)
   - Template caching
   - Skeleton loaders for perceived performance
   - Optimized database queries (no N+1 problems)

4. **User Experience**:
   - Real-time search and filtering
   - Advanced multi-tag filtering
   - Toast notifications for feedback
   - Responsive error handling with retry options

### 18. Common Commands
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