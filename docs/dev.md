# Development Guide

## Tech Stack

### Core
- **Express.js** - Web framework with session management
- **TypeScript** - Type safety with strict mode
- **PostgreSQL** - Database with session storage
- **Drizzle ORM** - Lightweight, type-safe ORM with SQL-like syntax
- **express-session** - Session management with PostgreSQL store

### Frontend
- **EJS** - Server-side templating for dashboards
- **Chart.js** - Interactive charts and data visualization
- **Tailwind CSS** - Utility-first CSS framework (via CDN)

### Development Tools
- **Biome** - Fast JavaScript/TypeScript formatter and linter
- **Prettier** - CSS formatting
- **JS-Beautify** - EJS template formatting
- **Vitest** - Unit testing
- **Playwright** - E2E testing

## Getting Started

1. Clone the repository
2. Copy `.env.template` to `.env` and configure database settings
3. Install dependencies: `pnpm install`
4. Start PostgreSQL database:
   ```bash
   cd utils/docker-compose
   ./init-data-volumes.sh
   ./docker-compose.sh up -d
   ```
5. Run migrations: `pnpm db:migrate`
6. Start development server: `pnpm start:dev`

The PostgreSQL database will be available at `localhost:9099` with:
- User: `localdev`
- Password: (see `utils/docker-compose/docker-secrets/db-password`)
- Database: `claude_code_stats`

## Development Commands

### Application
- `pnpm start:dev` - Start development server with hot reload
- `pnpm build` - Build for production
- `pnpm check` - Run all formatters and linters
- `pnpm test` - Run tests

### Database
- `pnpm db:generate` - Generate new migration from schema changes
- `pnpm db:migrate` - Apply migrations to database
- `pnpm db:studio` - Open Drizzle Studio for database GUI

### Code Formatting
- `pnpm format:all` - Format all CSS and EJS files
- `pnpm format:ejs` - Format EJS templates with JS-Beautify
- `pnpm format:css` - Format CSS files with Prettier

## API Endpoints

### Statistics API
- `GET /health` - Health check endpoint
- `POST /claude-code-stats?username=<username>` - Upload usage statistics JSON
  - Requires `X-API-Key` header with user's API key
  - Returns 204 No Content on success
- `GET /claude-code-stats` - Get statistics data as JSON (with optional filters)
  - Query parameters: `period`, `user`, `model`

### Admin Endpoints (Protected)
- `GET /admin/users` - List all users (requires X-Admin-Key header)
- `POST /admin/users` - Create new user with API key
- `GET /admin/users/:username` - Get specific user details
- `POST /admin/users/:username/api-key/regenerate` - Regenerate user's API key
- `POST /admin/users/:username/api-key/check` - Validate user's API key

### Dashboard Views
- `GET /dashboard` - Interactive statistics dashboard with charts
  - Query parameters:
    - `period`: `week` (default), `month`, or `all`
    - `user`: Filter by specific username
    - `groupBy`: Group data by `user`, `model`, or `date`
- `GET /dashboard/admin` - Admin dashboard for user management
  - Session-based authentication required
  - Full CRUD operations on users
  - Advanced search and filtering
- `GET /error` - Error page for handling exceptions

## Docker Development

### Building the Image
```bash
./docker-build.sh
```

### GitHub Actions Workflow
The repository includes a GitHub Actions workflow for automatic Docker builds and pushes to Docker Hub. See [GitHub Secrets Documentation](github-secrets.md) for setup instructions.

## Configuration

### Environment Variables
See `.env.template` for required environment variables.

### Content Security Policy
The application uses Helmet for security with a configured CSP that allows:
- CDN resources for Tailwind CSS and Chart.js
- Inline scripts for Chart.js initialization
- Inline styles for Tailwind utility classes

Configuration is in `/src/common/middleware/helmetConfig.ts`.

## Client-Side JavaScript Architecture

The admin dashboard uses a modular JavaScript architecture for better maintainability:

### Core Modules

1. **AdminApiClient** (`/public/js/admin-api-client.js`)
   - Handles all API communications
   - Automatic CSRF token management
   - Error handling and retry logic
   - Methods for all user operations

2. **AdminUIManager** (`/public/js/admin-ui-manager.js`)
   - Manages UI state and interactions
   - Event handling and delegation
   - Real-time search with debouncing
   - Pagination and sorting controls

3. **TemplateLoader** (`/public/js/template-loader.js`)
   - Separates HTML from JavaScript
   - Template caching and rendering
   - Icon registry for SVG management
   - Support for both server and client templates

4. **LoadingManager** (`/public/js/loading-manager.js`)
   - Global and inline loading states
   - Error display with retry mechanisms
   - Skeleton loaders for better UX
   - Toast notification system

### Template Organization
Templates are separated from JavaScript code:
- Server-side EJS partials in `/views/partials/admin/`
- Client-side templates use HTML `<template>` elements
- No HTML strings embedded in JavaScript files

## Project Structure

```
├── src/
│   ├── api/              # API endpoints
│   │   ├── auth/         # API key management & authentication
│   │   ├── health/       # Health check
│   │   ├── stats/        # Statistics upload/retrieval
│   │   ├── tags/         # User tag management
│   │   ├── user/         # User CRUD operations
│   │   └── views/        # Dashboard views
│   ├── api-docs/         # OpenAPI/Swagger configuration
│   ├── common/           # Shared utilities
│   │   ├── middleware/   # Auth, session, CSRF middleware
│   │   ├── schemas/      # Zod validation schemas
│   │   └── utils/        # Helper functions
│   ├── db/               # Database configuration
│   │   ├── schema.ts     # Drizzle schema definitions
│   │   └── index.ts      # Database connection
│   ├── public/           # Static assets
│   │   ├── css/          # Compiled CSS files
│   │   └── js/           # Client-side JavaScript
│   │       ├── admin-api-client.js    # API communication layer
│   │       ├── admin-ui-manager.js    # UI state management
│   │       ├── template-loader.js     # HTML template management
│   │       └── loading-manager.js     # Loading & error states
│   ├── styles/           # Source SCSS files
│   └── views/            # EJS templates
│       ├── dashboard/    # Admin dashboard views
│       ├── layouts/      # Page layouts
│       └── partials/     # Reusable components
│           └── admin/    # Admin-specific partials
├── drizzle/              # Database migrations
├── utils/                # Utility scripts
│   ├── docker-compose/   # Docker setup
│   ├── helpers/          # User management scripts
│   ├── release/          # Release management
│   └── upload-stats/     # Stats upload script
└── docs/                 # Documentation

```

## Contributing

See [CLAUDE.md](../CLAUDE.md) for important development guidelines and best practices.