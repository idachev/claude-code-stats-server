# Database Structure - Claude Code Stats Server

## Database Technology

### PostgreSQL with Drizzle ORM
We're using PostgreSQL as our primary database with Drizzle ORM for the following reasons:

**PostgreSQL:**
- Industry-standard for production applications
- Excellent JSON/JSONB support for storing usage statistics
- Advanced indexing capabilities for performance
- Robust concurrent access handling
- Strong data integrity and ACID compliance

**Drizzle ORM:**
- Lightweight, performant TypeScript ORM
- Excellent ESNext/ES modules support (no CommonJS issues)
- SQL-like syntax with full type safety
- No decorators needed (pure TypeScript)
- Simple migration system with Drizzle Kit
- Automatic TypeScript type inference from schema

## Database Schema

### Table: `users`
Stores unique users who upload statistics.

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX username_idx ON users(username);
```

**Columns:**
- `id`: Auto-incrementing primary key
- `username`: Unique identifier for each user (from ccusage upload)
- `created_at`: Timestamp when user was first created
- `updated_at`: Timestamp when user record was last modified

### Table: `usage_stats`
Stores daily aggregated statistics for each user.

```sql
CREATE TABLE usage_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_tokens INTEGER DEFAULT 0 NOT NULL,
    input_tokens INTEGER DEFAULT 0 NOT NULL,
    output_tokens INTEGER DEFAULT 0 NOT NULL,
    cache_creation_input_tokens INTEGER DEFAULT 0 NOT NULL,
    cache_read_input_tokens INTEGER DEFAULT 0 NOT NULL,
    total_cost DECIMAL(10, 4) DEFAULT '0' NOT NULL,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL,
    UNIQUE(user_id, date)
);

CREATE UNIQUE INDEX user_date_idx ON usage_stats(user_id, date);
CREATE INDEX date_idx ON usage_stats(date);
```

**Columns:**
- `id`: Auto-incrementing primary key
- `user_id`: Foreign key to users table
- `date`: The date for these statistics (stored as DATE type)
- `total_tokens`: Sum of all tokens
- `input_tokens`: Total input tokens for the day
- `output_tokens`: Total output tokens for the day
- `cache_creation_input_tokens`: Tokens used for cache creation
- `cache_read_input_tokens`: Tokens read from cache
- `total_cost`: Total cost in dollars for the day (DECIMAL for accuracy)
- `created_at`: Timestamp when record was created
- `updated_at`: Timestamp when record was last modified

**Indexes:**
- Composite unique index on (user_id, date) for fast user-specific queries and preventing duplicates
- Index on date for time-based aggregations

### Table: `model_usage`
Stores breakdown of usage by AI model for each day.

```sql
CREATE TABLE model_usage (
    id SERIAL PRIMARY KEY,
    usage_stats_id INTEGER NOT NULL REFERENCES usage_stats(id) ON DELETE CASCADE,
    model VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    input_tokens INTEGER DEFAULT 0 NOT NULL,
    output_tokens INTEGER DEFAULT 0 NOT NULL,
    cache_creation_input_tokens INTEGER DEFAULT 0 NOT NULL,
    cache_read_input_tokens INTEGER DEFAULT 0 NOT NULL,
    cost DECIMAL(10, 4) DEFAULT '0' NOT NULL,
    created_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX usage_stats_model_idx ON model_usage(usage_stats_id, model);
```

**Columns:**
- `id`: Auto-incrementing primary key
- `usage_stats_id`: Foreign key to usage_stats table
- `model`: Name of the AI model (e.g., "claude-opus-4-20250514")
- `provider`: Provider name (e.g., "anthropic")
- `input_tokens`: Input tokens for this model
- `output_tokens`: Output tokens for this model
- `cache_creation_input_tokens`: Cache creation tokens for this model
- `cache_read_input_tokens`: Cache read tokens for this model
- `cost`: Cost in dollars for this model usage
- `created_at`: Timestamp when record was created

**Indexes:**
- Composite index on (usage_stats_id, model) for efficient joins and model-specific queries

## Drizzle Schema Definition

The schema is defined in `/src/db/schema.ts` using Drizzle's type-safe schema builder:

```typescript
import { pgTable, serial, varchar, timestamp, integer, date, decimal, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  usernameIdx: uniqueIndex("username_idx").on(table.username),
}));

// Usage stats table
export const usageStats = pgTable("usage_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  totalTokens: integer("total_tokens").notNull().default(0),
  // ... other fields
}, (table) => ({
  userDateIdx: uniqueIndex("user_date_idx").on(table.userId, table.date),
  dateIdx: index("date_idx").on(table.date),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  usageStats: many(usageStats),
}));
```

## Data Types Rationale

### INTEGER for Token Counts
Token counts are stored as INTEGER which can handle values up to 2,147,483,647, sufficient for daily token counts.

### DECIMAL for Costs
Using DECIMAL(10, 4) ensures accurate monetary calculations without floating-point errors:
- 10 total digits
- 4 decimal places for precision
- Stored as string in JavaScript to prevent precision loss

### DATE for Daily Stats
Using DATE type (not TIMESTAMP) for daily statistics since we aggregate by day.

## Database Connection

### Connection Configuration
```typescript
// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "9099"),
  user: process.env.DB_USER || "localdev",
  password: process.env.DB_PASSWORD || "db-test-pass",
  database: process.env.DB_NAME || "claude_code_stats",
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = drizzle(pool, { schema });
```

## Migration Strategy

### Using Drizzle Kit
```bash
# Generate migration from schema changes
pnpm db:generate

# Apply migrations to database
pnpm db:migrate

# Open Drizzle Studio for GUI
pnpm db:studio
```

### Migration Files
- Stored in `/drizzle/` directory
- Named with timestamp and descriptive name
- SQL files that can be reviewed before application
- Applied sequentially and tracked in database

### Example Migration
```sql
-- drizzle/0000_typical_prodigy.sql
CREATE TABLE "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "username" varchar(50) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "users_username_unique" UNIQUE("username")
);

CREATE TABLE "usage_stats" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "date" date NOT NULL,
  -- ... other columns
);

ALTER TABLE "usage_stats" ADD CONSTRAINT "usage_stats_user_id_users_id_fk" 
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;

CREATE UNIQUE INDEX "user_date_idx" ON "usage_stats" ("user_id","date");
```

## Common Queries (Using Drizzle)

### Insert or Update User Stats
```typescript
// Upsert user
const [user] = await db
  .insert(users)
  .values({ username })
  .onConflictDoNothing()
  .returning();

// Upsert daily stats
await db
  .insert(usageStats)
  .values({
    userId: user.id,
    date,
    inputTokens,
    outputTokens,
    totalTokens,
    totalCost: totalCost.toString(),
  })
  .onConflictDoUpdate({
    target: [usageStats.userId, usageStats.date],
    set: {
      inputTokens,
      outputTokens,
      totalTokens,
      totalCost: totalCost.toString(),
      updatedAt: new Date(),
    },
  });
```

### Get Weekly Stats
```typescript
const startDate = new Date();
startDate.setDate(startDate.getDate() - 7);

const results = await db
  .select({
    username: users.username,
    date: usageStats.date,
    totalCost: usageStats.totalCost,
    totalTokens: usageStats.totalTokens,
  })
  .from(usageStats)
  .innerJoin(users, eq(usageStats.userId, users.id))
  .where(gte(usageStats.date, startDate.toISOString().split('T')[0]))
  .orderBy(desc(usageStats.date));
```

### Transaction Example
```typescript
await db.transaction(async (tx) => {
  // Find or create user
  const [user] = await tx
    .select()
    .from(users)
    .where(eq(users.username, username));

  // Insert stats
  const [stats] = await tx
    .insert(usageStats)
    .values(statsData)
    .returning();

  // Insert model usage
  await tx
    .insert(modelUsage)
    .values(modelData);
});
```

## Performance Considerations

### Indexing Strategy
- Primary indexes on all foreign keys for fast joins
- Unique composite index on (user_id, date) prevents duplicates and speeds queries
- Single column index on date for time-based aggregations
- Composite index on (usage_stats_id, model) for model-specific analytics

### Query Optimization
1. Use Drizzle's query builder for type-safe, optimized queries
2. Leverage indexes by filtering on indexed columns
3. Use transactions for multi-table operations
4. Connection pooling reduces overhead (20 connections max)
5. Use `select()` with specific columns instead of selecting all

### Data Retention
For long-term sustainability, consider:
- Archiving old data to cold storage after 90 days
- Aggregating old daily data into monthly summaries
- Implementing table partitioning by month for large datasets

## Backup Strategy

### Automated Backups
```bash
#!/bin/bash
# Daily backup script
BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="claude_code_stats"

pg_dump -h localhost -p 9099 -U localdev -d $DB_NAME | gzip > $BACKUP_DIR/backup_$TIMESTAMP.sql.gz

# Keep only last 30 days of backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
```

## Security Considerations

### Access Control
- Application uses a dedicated database user with limited permissions
- Connection string stored in environment variables
- Password stored securely in docker-secrets

### Data Protection
- Parameterized queries via Drizzle prevent SQL injection
- Input validation with Zod schemas before database operations
- Foreign key constraints maintain referential integrity
- CASCADE deletes ensure no orphaned records

## Monitoring

### Key Metrics to Track
- Connection pool usage
- Query execution time
- Table sizes and growth rate
- Index usage statistics

### Health Checks
```typescript
// Database health check
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const result = await pool.query("SELECT 1");
    return result.rowCount > 0;
  } catch (error) {
    logger.error(error as Error, "Database health check failed");
    return false;
  }
};
```

### Drizzle Studio
Use `pnpm db:studio` to open a GUI for:
- Browsing data
- Running queries
- Viewing schema
- Managing records

## Docker PostgreSQL Setup

The project includes a Docker Compose setup for PostgreSQL 17:

```yaml
# utils/docker-compose/docker-compose.yaml
services:
  postgres:
    image: postgres:17
    ports:
      - "9099:5432"
    environment:
      POSTGRES_DB: claude_code_stats
      POSTGRES_USER: localdev
      POSTGRES_PASSWORD_FILE: /run/secrets/db-password
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

**Connection Details:**
- Host: localhost
- Port: 9099
- Database: claude_code_stats
- User: localdev
- Password: See `utils/docker-compose/docker-secrets/db-password`

---

**Document Version**: 2.0
**Last Updated**: 2025-08-20
**Technology**: PostgreSQL 17 with Drizzle ORM