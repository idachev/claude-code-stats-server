# Claude Code Stats Server - Build Plan

## Executive Summary
Build a simple, efficient server to collect and visualize Claude Code usage statistics from multiple users. The server will accept JSON uploads from the `ccusage` command and display aggregated statistics through a beautiful, server-rendered HTML interface.

## Technology Stack Selection

### Backend Framework: **Express.js (Node.js)**
**Why Express.js?**
- Most popular Node.js framework with excellent community support
- Lightweight and minimalistic - perfect for our simple REST API needs
- Fast development cycle
- Native JSON handling
- Easy deployment options

### Template Engine: **EJS (Embedded JavaScript Templates)**
**Why EJS?**
- Simple syntax - just HTML with embedded JavaScript
- No learning curve for developers familiar with HTML/JavaScript
- Excellent performance for server-side rendering
- Easy integration with Express.js
- Perfect for data-driven dashboards

### Database: **PostgreSQL with Drizzle ORM**
**Why PostgreSQL?**
- Industry-standard for production applications
- Excellent JSON/JSONB support for storing usage statistics
- Advanced indexing capabilities for performance
- Robust concurrent access handling
- Strong data integrity and ACID compliance

**Why Drizzle ORM?**
- Lightweight and performant TypeScript ORM
- Excellent ESNext/ES modules support
- SQL-like syntax with full type safety
- Simple migration system
- No decorators needed (pure TypeScript)
- Better suited for modern JavaScript runtimes

### Additional Technologies
- **Drizzle ORM** - Type-safe ORM for PostgreSQL
- **Drizzle Kit** - CLI tool for migrations and database management
- **Chart.js** - For rendering beautiful charts (similar to the example image)
- **Tailwind CSS** - For modern, responsive UI styling
- **Day.js** - For date manipulation and formatting
- **dotenv** - For environment configuration
- **Zod** - For schema validation and type inference
- **Express Validator** - For input validation
- **Helmet** - For basic security headers
- **Playwright** - For end-to-end testing

## Project Structure
```
claude-code-stats-server/
├── src/
│   ├── index.ts            # Application entry point
│   ├── server.ts           # Express server setup
│   ├── db/
│   │   ├── index.ts        # Database connection and exports
│   │   └── schema.ts       # Drizzle schema definitions
│   ├── api/
│   │   ├── health/
│   │   │   └── healthRouter.ts
│   │   └── stats/
│   │       ├── statsRouter.ts
│   │       └── statsService.ts
│   ├── api-docs/
│   │   ├── openAPIDocumentGenerator.ts  # Swagger documentation
│   │   └── openAPIResponseBuilders.ts
│   ├── views/
│   │   ├── stats.ejs       # Main stats dashboard
│   │   └── partials/       # Reusable EJS components
│   ├── public/
│   │   ├── css/            # Tailwind output & custom styles
│   │   └── js/             # Client-side JavaScript for charts
│   └── common/
│       ├── middleware/
│       │   ├── errorHandler.ts
│       │   └── rateLimiter.ts
│       └── utils/
│           └── envConfig.ts
├── drizzle/                # Drizzle migrations
├── tests/                  # Playwright tests
│   └── api.spec.ts        # API endpoint tests
├── docs/
│   ├── tasks/
│   │   └── task-build-plan.md  # This file
│   ├── db-structure.md    # Database documentation
│   ├── imgs/              # Reference images
│   └── data/              # Sample data
├── utils/
│   └── docker-compose/    # Docker PostgreSQL setup
│       ├── docker-compose.yaml  # PostgreSQL 17 configuration
│       ├── docker-compose.sh     # Helper script
│       ├── init-data-volumes.sh  # Volume initialization
│       └── docker-secrets/       # Database password
├── .env.template
├── CLAUDE.md              # Technical development guide
├── README.md              # Project overview
├── drizzle.config.ts      # Drizzle configuration
├── playwright.config.ts   # Playwright test configuration
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

## API Endpoints Specification

### 1. GET /health
- **Purpose**: Health check for monitoring
- **Response**: 
```json
{
  "status": "ok",
  "database": true,
  "timestamp": "2025-08-19T..."
}
```
- **Status Code**: 200

### 2. POST /claude-code-stats
- **Purpose**: Upload usage statistics
- **Query Params**: `username` (required)
- **Body**: JSON data from ccusage (see example in docs/data/)
- **Request Body Schema**:
```json
{
  "daily": [
    {
      "date": "YYYY-MM-DD",
      "inputTokens": number,
      "outputTokens": number,
      "cacheCreationTokens": number,
      "cacheReadTokens": number,
      "totalTokens": number,
      "totalCost": number,
      "modelBreakdowns": [
        {
          "modelName": string,
          "provider": string,
          "inputTokens": number,
          "outputTokens": number,
          "cacheCreationTokens": number,
          "cacheReadTokens": number,
          "cost": number
        }
      ]
    }
  ]
}
```
- **Validation**:
  - Username must be alphanumeric, 3-50 characters
  - JSON must match ccusage schema
  - Prevents duplicate uploads (upserts based on date + username)
- **Response**: No content (204 No Content status)
- **Status Codes**: 204 (success), 400 (validation error), 500 (server error)
- **Error Response Format**:
```json
{
  "error": "Error message",
  "timestamp": "2025-08-19T...",
  "status": 400
}
```

### 3. GET /claude-code-stats
- **Purpose**: Retrieve statistics as JSON
- **Query Params** (optional):
  - `period`: "week" | "month" (default: "week")
  - `user`: specific username to filter
  - `model`: filter by model (format: "provider/model-name")
- **Response**: JSON with aggregated statistics

### 4. Admin Endpoints (Protected with X-Admin-Key header)

#### GET /admin/users
- **Purpose**: List all users
- **Authentication**: Requires `X-Admin-Key` header
- **Response**: Array of user objects

#### POST /admin/users
- **Purpose**: Create new user with API key
- **Authentication**: Requires `X-Admin-Key` header
- **Body**: `{ "username": "string" }`
- **Response**: User with generated API key

#### GET /admin/users/:username
- **Purpose**: Get specific user details
- **Authentication**: Requires `X-Admin-Key` header
- **Response**: User object

#### POST /admin/users/:username/api-key/regenerate
- **Purpose**: Regenerate user's API key
- **Authentication**: Requires `X-Admin-Key` header
- **Response**: New API key

#### POST /admin/users/:username/api-key/check
- **Purpose**: Validate user's API key
- **Authentication**: Requires `X-Admin-Key` header
- **Body**: `{ "apiKey": "string" }`
- **Response**: Validation result

### 5. Dashboard Views

#### GET /dashboard
- **Purpose**: Interactive statistics dashboard with charts
- **Query Params** (optional):
  - `period`: "week" | "month" | "all" (default: "week")
  - `user`: specific username to filter
  - `model`: filter by model
  - `groupBy`: "user" | "model" | "date"
- **Response**: Server-rendered HTML with Chart.js visualizations

## Database Schema

The complete database structure is documented in [`docs/db-structure.md`](../db-structure.md).

**Key Tables:**
- `users` - Stores unique users who upload statistics
- `usage_stats` - Daily aggregated statistics per user
- `model_usage` - Breakdown of usage by AI model

**Technology:** PostgreSQL with Drizzle ORM for type-safe database operations

**Schema Definition:**
- Defined in `/src/db/schema.ts` using Drizzle's schema builder
- Type-safe with automatic TypeScript type inference
- Supports relations between tables

**Migration System:**
- Uses Drizzle Kit for migration management
- Migrations stored in `/drizzle/` directory
- Applied using `pnpm db:migrate` for production-like tracking

## UI/UX Design (Phase 4 - Not Yet Implemented)

### Dashboard Layout
Based on the example image, the dashboard will include:

1. **Header Section**
   - Title: "Claude Code Usage Statistics"
   - Period selector (Week/Month dropdown)
   - User filter dropdown
   - Export button

2. **Summary Cards** (Top Row)
   - Total Token Cost (with donut chart)
   - Total Web Search Cost (with donut chart)
   - Total Code Execution Cost

3. **Daily Token Cost Chart** (Main Section)
   - Stacked bar chart showing daily costs
   - Color-coded by model type
   - Interactive tooltips showing detailed breakdown
   - Legend showing all models with colors

4. **User Statistics Table** (Bottom Section)
   - Username
   - Total Cost
   - Most Used Model
   - Token Count
   - Last Active

## Implementation Phases

### Phase 1: Core Setup ✅ (Completed)
- ✅ Set up Drizzle ORM configuration
- ✅ Create schema definitions (users, usageStats, modelUsage)
- ✅ Configure database connection
- ✅ Generate and run initial migration
- ✅ Implement basic error handling middleware

### Phase 2: API Development ✅ (Completed)
- ✅ Implement GET /health endpoint with database check
- ✅ Implement POST /claude-code-stats endpoint
- ✅ Create validation for username and JSON body
- ✅ Set up Drizzle database operations
- ✅ Implement stats service for data insertion
- ✅ Register endpoints in Swagger/OpenAPI

### Phase 3: Data Processing ✅ (Completed)
- ✅ Parse and validate ccusage JSON format
- ✅ Transform JSON data to schema format
- ✅ Implement upsert logic for daily stats
- ✅ Create aggregation queries for statistics
- ✅ Add proper database indexes
- ✅ Test with Playwright

### Phase 4: Frontend Development ✅ (Completed)
- ✅ Set up EJS templates and view engine
- ✅ Configure Tailwind CSS (via CDN)
- ✅ Create stats dashboard layout with dark theme
- ✅ Integrate Chart.js for visualizations
- ✅ Implement GET /dashboard route for HTML view
- ✅ Add period and user filtering UI
- ✅ Add model filtering and groupBy options
- ✅ Implement stacked bar charts for daily usage
- ✅ Add donut charts for cost distribution

### Phase 5: Testing & Polish (1-2 hours)
- ✅ Write Playwright tests for API endpoints
- [ ] Add more comprehensive test coverage
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Documentation updates

### Phase 6: Production Ready (1-2 hours)
- [ ] Production configuration
- [ ] Docker containerization
- [ ] Deployment documentation
- [ ] Final testing

## Security Considerations

### Current Implementation
- Input validation on all endpoints using Zod schemas
- SQL injection prevention (parameterized queries via Drizzle)
- XSS protection in templates
- Rate limiting on upload endpoint
- CORS configuration
- Helmet.js for security headers
- API key authentication for stats upload
- Admin authentication for user management endpoints

## Performance Optimizations

- Database indexing on frequently queried columns
- Connection pooling (20 connections max)
- Transaction support for data consistency
- Efficient upsert operations
- Lazy loading for large datasets (planned)
- Gzip compression for responses

## Testing Strategy

### Current Tests (Playwright)
- ✅ Health endpoint validation
- ✅ Stats upload with valid data
- ✅ Stats retrieval with filtering
- ✅ Invalid data rejection
- ✅ Required parameter validation

### Future Tests
- Unit tests for services
- Integration tests for full flow
- Performance tests with concurrent uploads
- Edge cases (empty data, malformed JSON)

## Deployment Options

### Development
```bash
# Start PostgreSQL using provided Docker Compose
cd utils/docker-compose
./init-data-volumes.sh  # Initialize volumes
./docker-compose.sh up -d  # Start PostgreSQL 17

# Database will be available at localhost:9099
# User: localdev
# Password: see utils/docker-compose/docker-secrets/db-password
# Database: claude_code_stats

# Run migrations
pnpm db:migrate

# Start development server
pnpm start:dev  # Runs on port 3000 by default
```

### Production
- **Option 1**: Node.js on VPS (DigitalOcean, Linode)
- **Option 2**: Container on Cloud Run/ECS
- **Option 3**: Heroku with PostgreSQL addon
- **Option 4**: Vercel/Netlify with Serverless functions

## Monitoring & Maintenance

- Health check endpoint for uptime monitoring
- Error logging with timestamps (pino logger)
- Database backup schedule
- Drizzle Studio for database GUI (`pnpm db:studio`)

## Key Technical Decisions

### Why we switched from TypeORM to Drizzle
1. **ESNext/ES Module Support**: Drizzle works seamlessly with modern JavaScript module systems
2. **Lightweight**: Smaller bundle size and faster startup
3. **Type Safety**: Better TypeScript inference without decorators
4. **SQL-like Syntax**: More intuitive for developers familiar with SQL
5. **Simple Migrations**: Straightforward migration generation and application

### Migration Strategy
- Always use `pnpm db:migrate` (not `db:push`) for production-like migration tracking
- Migrations are versioned and stored in `/drizzle/` directory
- Each migration is immutable once applied

### API Documentation
- All endpoints must be registered in OpenAPI/Swagger
- Available at http://localhost:3000/swagger
- Provides interactive testing interface

---

## Success Metrics

### Current Implementation
- ✅ Successfully accepts and stores ccusage JSON uploads
- ✅ Returns accurate statistics via API
- ✅ Handles multiple users without data conflicts
- ✅ All Playwright tests passing
- ✅ Swagger documentation complete for existing endpoints

### Remaining Goals
- Display statistics in beautiful HTML dashboard
- Page load time < 2 seconds
- Support for data export
- 99.9% uptime

## Timeline

**Phases 1-3**: ✅ Completed
**Phase 4 (Frontend)**: 2-3 hours estimated
**Phase 5-6 (Polish & Production)**: 3-4 hours estimated

---

**Document Version**: 3.0
**Last Updated**: 2025-08-21
**Status**: Complete - All phases implemented including dashboard, authentication, and admin endpoints