# Claude Code Stats Server - Build Plan

## Executive Summary
Build a simple, efficient server to collect and visualize Claude Code usage statistics from multiple users. The server will accept JSON uploads from the `ccusage` command and display aggregated statistics through a beautiful, server-rendered HTML interface.

## Technology Stack Selection

### Backend Framework: **Express.js (Node.js)**
**Why Express.js?**
- Most popular Node.js framework with 66.388 GitHub score
- Lightweight and minimalistic - perfect for our simple REST API needs
- Excellent ecosystem and community support
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

### Database: **PostgreSQL with TypeORM**
**Why PostgreSQL?**
- Industry-standard for production applications
- Excellent JSON/JSONB support for storing usage statistics
- Advanced indexing capabilities for performance
- Robust concurrent access handling
- Built-in full-text search capabilities
- Strong data integrity and ACID compliance

**Why TypeORM?**
- Type-safe database operations with TypeScript
- Decorator-based entity definitions
- Automatic migrations generation
- Built-in connection pooling
- Repository pattern for clean code organization
- Consistent with enterprise patterns (like backoffice-backend)

### Additional Technologies
- **TypeORM** - Type-safe ORM for PostgreSQL
- **Chart.js** - For rendering beautiful charts (similar to the example image)
- **Tailwind CSS** - For modern, responsive UI styling
- **Day.js** - For date manipulation and formatting
- **dotenv** - For environment configuration
- **reflect-metadata** - Required for TypeORM decorators
- **Express Validator** - For input validation
- **Helmet** - For basic security headers

## Project Structure
```
claude-code-stats-server/
├── src/
│   ├── index.ts            # Application entry point
│   ├── server.ts           # Express server setup
│   ├── data-source.ts      # TypeORM data source configuration
│   ├── api/
│   │   ├── health/
│   │   │   └── healthRouter.ts
│   │   └── stats/
│   │       ├── statsRouter.ts
│   │       ├── statsController.ts
│   │       └── statsService.ts
│   ├── entities/
│   │   ├── User.ts         # User entity
│   │   ├── UsageStats.ts   # Usage statistics entity
│   │   └── ModelUsage.ts   # Model usage entity
│   ├── views/
│   │   ├── stats.ejs       # Main stats dashboard
│   │   └── partials/       # Reusable EJS components
│   ├── public/
│   │   ├── css/            # Tailwind output & custom styles
│   │   └── js/             # Client-side JavaScript for charts
│   └── common/
│       └── utils/
│           └── dataProcessor.ts
├── migration/              # TypeORM migrations
├── tests/                   # Unit and integration tests
├── docs/
│   ├── build-plan.md       # This file
│   ├── imgs/               # Reference images
│   └── data/               # Sample data
├── utils/
│   └── docker-compose/     # Docker PostgreSQL setup
│       ├── docker-compose.yaml  # PostgreSQL 17 configuration
│       ├── docker-compose.sh     # Helper script
│       ├── init-data-volumes.sh  # Volume initialization
│       └── docker-secrets/       # Database password
├── .env.template
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

## API Endpoints Specification

### 1. GET /health
- **Purpose**: Health check for monitoring
- **Response**: `{ "status": "ok", "timestamp": "2025-08-19T..." }`
- **Status Code**: 200

### 2. POST /claude-code-stats
- **Purpose**: Upload usage statistics
- **Query Params**: `username` (required)
- **Body**: JSON data from ccusage (see example in docs/data/)
- **Validation**:
  - Username must be alphanumeric, 3-50 characters
  - JSON must match ccusage schema
  - Prevent duplicate uploads (based on date + username)
- **Response**: `{ "success": true, "message": "Stats uploaded successfully" }`
- **Status Codes**: 200 (success), 400 (validation error), 409 (duplicate)

### 3. GET /claude-code-stats
- **Purpose**: Display statistics dashboard
- **Query Params** (optional):
  - `period`: "week" | "month" (default: "week")
  - `user`: specific username to filter
- **Response**: Server-rendered HTML with:
  - Cost overview (similar to example image)
  - Daily token cost chart
  - User breakdown
  - Model usage distribution
  - Filtering controls

## Database Schema

The complete database structure, including tables, indexes, migration strategy, and common queries, is documented in detail at [`docs/db-structure.md`](./db-structure.md).

**Key Tables:**
- `users` - Stores unique users who upload statistics
- `usage_stats` - Daily aggregated statistics per user
- `model_usage` - Breakdown of usage by AI model

**Technology:** PostgreSQL with TypeORM for type-safe database operations

**Entity Classes:**
- `User` - TypeORM entity with decorators
- `UsageStats` - Entity with JSONB column for raw data
- `ModelUsage` - Entity with relationships to UsageStats

**Repository Pattern:**
- Type-safe queries using TypeORM repositories
- Custom repository methods for complex aggregations
- Built-in connection pooling and transaction support

## UI/UX Design

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

### Visual Design
- Dark theme matching the example
- Color palette for models (consistent across all charts)
- Responsive design for mobile/tablet/desktop
- Smooth animations for data updates

## Implementation Phases

### Phase 1: Core Setup (Day 1)
- [ ] Initialize TypeScript Express project
- [ ] Set up project structure with TypeORM
- [ ] Configure TypeScript and ESLint
- [ ] Set up TypeORM data source
- [ ] Create entity definitions with decorators
- [ ] Generate and run initial migration
- [ ] Implement basic error handling middleware

### Phase 2: API Development (Day 2)
- [ ] Implement GET /health endpoint
- [ ] Implement POST /claude-code-stats with validation
- [ ] Create TypeORM repositories and services
- [ ] Implement repository pattern for data access
- [ ] Add data processing utilities
- [ ] Write unit tests for services and endpoints

### Phase 3: Data Processing (Day 3)
- [ ] Parse and validate ccusage JSON format
- [ ] Use TypeORM query builder for aggregations
- [ ] Create custom repository methods for statistics
- [ ] Implement date filtering with TypeORM operators
- [ ] Calculate totals using TypeORM aggregation functions
- [ ] Add database indexes for performance

### Phase 4: Frontend Development (Day 4-5)
- [ ] Set up EJS templates
- [ ] Configure Tailwind CSS
- [ ] Create stats dashboard layout
- [ ] Integrate Chart.js for visualizations
- [ ] Implement filtering controls
- [ ] Add responsive design

### Phase 5: Testing & Polish (Day 6)
- [ ] Integration testing
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Documentation
- [ ] Docker containerization

### Phase 6: Deployment Preparation
- [ ] Production configuration
- [ ] PostgreSQL migration scripts
- [ ] Deployment documentation
- [ ] CI/CD pipeline setup

## Security Considerations

### Current Implementation (V1)
- Input validation on all endpoints
- SQL injection prevention (parameterized queries)
- XSS protection in templates
- Rate limiting on upload endpoint
- CORS configuration
- Helmet.js for security headers

## Performance Optimizations

- Database indexing on frequently queried columns
- Caching aggregated statistics (5-minute TTL)
- Lazy loading for large datasets
- Pagination for user lists
- Gzip compression for responses
- Static asset optimization

## Testing Strategy

### Unit Tests
- API endpoint validation
- Data processing functions
- Database operations

### Integration Tests
- Full upload → process → display flow
- Multi-user scenarios
- Edge cases (empty data, malformed JSON)

### Performance Tests
- Load testing with multiple concurrent uploads
- Large dataset rendering
- Database query optimization

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

npm run start:dev  # Runs with hot reload and local PostgreSQL
```

### Production
- **Option 1**: Node.js on VPS (DigitalOcean, Linode)
- **Option 2**: Container on Cloud Run/ECS
- **Option 3**: Heroku with PostgreSQL addon
- **Option 4**: Vercel/Netlify with Serverless functions

## Monitoring & Maintenance

- Health check endpoint for uptime monitoring
- Error logging with timestamps
- Database backup schedule
- Usage analytics (optional)

---

# Optional Enhancements (V2)

## Authentication & Authorization
- **JWT-based authentication**
  - User registration/login
  - Protected upload endpoints
  - User-specific dashboards
- **API Key management**
  - Generate unique API keys per user
  - Rate limiting per key
  - Key rotation

## Advanced Features
- **Export Capabilities**
  - CSV export of statistics
  - PDF reports generation
  - API for programmatic access
  
- **Real-time Updates**
  - WebSocket for live dashboard updates
  - Push notifications for cost thresholds
  
- **Cost Alerts**
  - Email notifications when costs exceed threshold
  - Daily/weekly summary emails
  
- **Team Features**
  - Organization/team management
  - Aggregated team statistics
  - Role-based access control

## Data Enhancements
- **Historical Trends**
  - Month-over-month comparisons
  - Predictive cost modeling
  - Usage pattern analysis
  
- **Advanced Filtering**
  - Date range selection
  - Model-specific views
  - Cost breakdown by feature (web search, code execution)

## Infrastructure Improvements
- **Caching Layer**
  - Redis for session management
  - Cached aggregations
  
- **Message Queue**
  - Process uploads asynchronously
  - Handle large batch uploads
  
- **Multi-database Support**
  - Read replicas for scaling
  - Data archival strategy

## Developer Experience
- **API Documentation**
  - OpenAPI/Swagger specification
  - Interactive API explorer
  
- **SDK/CLI Tools**
  - Node.js SDK for uploads
  - CLI for bulk operations
  
- **Webhooks**
  - Notify external systems of new data
  - Integration with Slack/Discord

## Compliance & Governance
- **Data Privacy**
  - GDPR compliance
  - Data retention policies
  - User data export/deletion
  
- **Audit Logging**
  - Track all data modifications
  - Access logs
  - Compliance reporting

## AI/ML Features
- **Anomaly Detection**
  - Identify unusual usage patterns
  - Cost spike alerts
  
- **Optimization Suggestions**
  - Recommend cost-saving strategies
  - Model selection optimization

---

## Success Metrics

### V1 Success Criteria
- Successfully accepts and stores ccusage JSON uploads
- Displays accurate statistics matching the example visualization
- Handles multiple users without data conflicts
- Page load time < 2 seconds
- 99.9% uptime

### V2 Success Criteria
- User authentication working securely
- Export functionality operational
- Real-time updates functioning
- Alert system reliable
- API documentation complete

## Timeline Estimate

**V1 MVP**: 5-6 days of development
**V2 with Optional Features**: Additional 2-3 weeks

## Questions for Stakeholder Review

1. Should we prioritize any specific V2 features for earlier implementation?
2. What is the expected number of users and upload frequency?
3. Are there any specific compliance requirements?
4. Preferred deployment platform?
5. Budget constraints for infrastructure?

---

## Next Steps

1. Review and approve this build plan
2. Set up development environment
3. Begin Phase 1 implementation
4. Schedule regular progress reviews

**Document Version**: 1.0
**Last Updated**: 2025-08-19
**Author**: AI Assistant
