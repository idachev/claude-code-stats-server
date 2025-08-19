# Database Structure - Claude Code Stats Server

## Database Technology

### PostgreSQL
We're using PostgreSQL as our primary database for the following reasons:
- Industry-standard for production applications
- Excellent JSON/JSONB support for storing usage statistics
- Advanced indexing capabilities for performance
- Robust concurrent access handling
- Built-in full-text search capabilities
- Strong data integrity and ACID compliance

## Database Schema

### Table: `users`
Stores unique users who upload statistics.

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Columns:**
- `id`: Auto-incrementing primary key
- `username`: Unique identifier for each user (from ccusage upload)
- `created_at`: Timestamp when user was first created

### Table: `usage_stats`
Stores daily aggregated statistics for each user.

```sql
CREATE TABLE usage_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    date DATE NOT NULL,
    input_tokens BIGINT,
    output_tokens BIGINT,
    cache_creation_tokens BIGINT,
    cache_read_tokens BIGINT,
    total_tokens BIGINT,
    total_cost DECIMAL(10, 2),
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, date)
);

CREATE INDEX idx_usage_stats_user_date ON usage_stats(user_id, date);
CREATE INDEX idx_usage_stats_date ON usage_stats(date);
```

**Columns:**
- `id`: Auto-incrementing primary key
- `user_id`: Foreign key to users table
- `date`: The date for these statistics
- `input_tokens`: Total input tokens for the day
- `output_tokens`: Total output tokens for the day
- `cache_creation_tokens`: Tokens used for cache creation
- `cache_read_tokens`: Tokens read from cache
- `total_tokens`: Sum of all tokens
- `total_cost`: Total cost in dollars for the day
- `raw_data`: Complete JSON data from ccusage (stored as JSONB)
- `created_at`: Timestamp when record was created

**Indexes:**
- Composite index on (user_id, date) for fast user-specific queries
- Index on date for time-based aggregations

**Constraints:**
- UNIQUE constraint on (user_id, date) prevents duplicate daily entries
- CASCADE delete ensures model_usage records are deleted when parent is deleted

### Table: `model_usage`
Stores breakdown of usage by AI model for each day.

```sql
CREATE TABLE model_usage (
    id SERIAL PRIMARY KEY,
    usage_stat_id INTEGER NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    input_tokens BIGINT,
    output_tokens BIGINT,
    cache_creation_tokens BIGINT,
    cache_read_tokens BIGINT,
    cost DECIMAL(10, 2),
    FOREIGN KEY (usage_stat_id) REFERENCES usage_stats(id) ON DELETE CASCADE
);

CREATE INDEX idx_model_usage_stat_id ON model_usage(usage_stat_id);
CREATE INDEX idx_model_usage_model_name ON model_usage(model_name);
```

**Columns:**
- `id`: Auto-incrementing primary key
- `usage_stat_id`: Foreign key to usage_stats table
- `model_name`: Name of the AI model (e.g., "claude-opus-4-20250514")
- `input_tokens`: Input tokens for this model
- `output_tokens`: Output tokens for this model
- `cache_creation_tokens`: Cache creation tokens for this model
- `cache_read_tokens`: Cache read tokens for this model
- `cost`: Cost in dollars for this model usage

**Indexes:**
- Index on usage_stat_id for join operations
- Index on model_name for model-specific queries

## Data Types Rationale

### BIGINT for Token Counts
Token counts can be very large (millions per day), so we use BIGINT to ensure we don't overflow.

### JSONB for Raw Data
PostgreSQL's JSONB type allows us to:
- Store the complete ccusage data for audit/debugging
- Query specific fields using JSON operators if needed
- Maintain data integrity with the original source

### DECIMAL for Costs
Using DECIMAL(10, 2) ensures accurate monetary calculations without floating-point errors.

## Database Connection

### Connection Pooling
```javascript
// Example configuration
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'claude_code_stats',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## Migration Strategy

### Using node-pg-migrate
```bash
# Create a new migration
npm run migrate:create -- add-users-table

# Run migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down
```

### Initial Migration
```javascript
// migrations/001_initial_schema.js
exports.up = (pgm) => {
  // Create users table
  pgm.createTable('users', {
    id: 'id',
    username: { type: 'varchar(50)', notNull: true, unique: true },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Create usage_stats table
  pgm.createTable('usage_stats', {
    id: 'id',
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    date: { type: 'date', notNull: true },
    input_tokens: { type: 'bigint' },
    output_tokens: { type: 'bigint' },
    cache_creation_tokens: { type: 'bigint' },
    cache_read_tokens: { type: 'bigint' },
    total_tokens: { type: 'bigint' },
    total_cost: { type: 'decimal(10,2)' },
    raw_data: { type: 'jsonb' },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Add unique constraint
  pgm.addConstraint('usage_stats', 'unique_user_date', {
    unique: ['user_id', 'date'],
  });

  // Create indexes
  pgm.createIndex('usage_stats', ['user_id', 'date']);
  pgm.createIndex('usage_stats', 'date');

  // Create model_usage table
  pgm.createTable('model_usage', {
    id: 'id',
    usage_stat_id: {
      type: 'integer',
      notNull: true,
      references: '"usage_stats"',
      onDelete: 'CASCADE',
    },
    model_name: { type: 'varchar(100)', notNull: true },
    input_tokens: { type: 'bigint' },
    output_tokens: { type: 'bigint' },
    cache_creation_tokens: { type: 'bigint' },
    cache_read_tokens: { type: 'bigint' },
    cost: { type: 'decimal(10,2)' },
  });

  // Create indexes for model_usage
  pgm.createIndex('model_usage', 'usage_stat_id');
  pgm.createIndex('model_usage', 'model_name');
};

exports.down = (pgm) => {
  pgm.dropTable('model_usage');
  pgm.dropTable('usage_stats');
  pgm.dropTable('users');
};
```

## Common Queries

### Insert or Update User Stats
```sql
-- Upsert user
INSERT INTO users (username) 
VALUES ($1) 
ON CONFLICT (username) DO NOTHING
RETURNING id;

-- Insert daily stats
INSERT INTO usage_stats (
    user_id, date, input_tokens, output_tokens,
    cache_creation_tokens, cache_read_tokens,
    total_tokens, total_cost, raw_data
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
ON CONFLICT (user_id, date) 
DO UPDATE SET
    input_tokens = EXCLUDED.input_tokens,
    output_tokens = EXCLUDED.output_tokens,
    cache_creation_tokens = EXCLUDED.cache_creation_tokens,
    cache_read_tokens = EXCLUDED.cache_read_tokens,
    total_tokens = EXCLUDED.total_tokens,
    total_cost = EXCLUDED.total_cost,
    raw_data = EXCLUDED.raw_data,
    created_at = CURRENT_TIMESTAMP;
```

### Get Weekly Stats
```sql
SELECT 
    u.username,
    us.date,
    us.total_cost,
    us.total_tokens,
    COALESCE(
        json_agg(
            json_build_object(
                'model_name', mu.model_name,
                'cost', mu.cost,
                'input_tokens', mu.input_tokens,
                'output_tokens', mu.output_tokens
            )
        ) FILTER (WHERE mu.id IS NOT NULL), 
        '[]'
    ) as model_breakdowns
FROM usage_stats us
JOIN users u ON us.user_id = u.id
LEFT JOIN model_usage mu ON us.id = mu.usage_stat_id
WHERE us.date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY u.username, us.date, us.total_cost, us.total_tokens
ORDER BY us.date DESC, u.username;
```

### Get Monthly Aggregated Stats by User
```sql
SELECT 
    u.username,
    SUM(us.total_cost) as total_cost,
    SUM(us.total_tokens) as total_tokens,
    COUNT(DISTINCT us.date) as active_days,
    MAX(us.date) as last_active
FROM usage_stats us
JOIN users u ON us.user_id = u.id
WHERE us.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY u.username
ORDER BY total_cost DESC;
```

### Get Model Usage Distribution
```sql
SELECT 
    mu.model_name,
    SUM(mu.cost) as total_cost,
    SUM(mu.input_tokens + mu.output_tokens) as total_tokens,
    COUNT(DISTINCT us.user_id) as unique_users
FROM model_usage mu
JOIN usage_stats us ON mu.usage_stat_id = us.id
WHERE us.date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY mu.model_name
ORDER BY total_cost DESC;
```

## Performance Considerations

### Indexing Strategy
- Primary indexes on foreign keys for fast joins
- Composite index on (user_id, date) for user-specific date range queries
- Single column index on date for time-based aggregations
- Model name index for model-specific analytics

### Query Optimization Tips
1. Use EXPLAIN ANALYZE to understand query plans
2. Consider partial indexes for frequently filtered queries
3. Use materialized views for complex aggregations
4. Implement pagination for large result sets
5. Use connection pooling to reduce overhead

### Data Retention
For long-term sustainability, consider:
- Archiving raw_data older than 90 days to cold storage
- Aggregating old daily data into monthly summaries
- Implementing partitioning for the usage_stats table by month

## Backup Strategy

### Automated Backups
```bash
# Daily backup script
#!/bin/bash
BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="claude_code_stats"

pg_dump -h localhost -U postgres -d $DB_NAME | gzip > $BACKUP_DIR/backup_$TIMESTAMP.sql.gz

# Keep only last 30 days of backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
```

### Point-in-Time Recovery
Configure PostgreSQL with WAL archiving for point-in-time recovery capabilities.

## Security Considerations

### Access Control
```sql
-- Create read-only user for reporting
CREATE USER stats_reader WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE claude_code_stats TO stats_reader;
GRANT USAGE ON SCHEMA public TO stats_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO stats_reader;

-- Create application user with limited permissions
CREATE USER app_user WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE claude_code_stats TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
```

### Data Sanitization
- Always use parameterized queries to prevent SQL injection
- Validate all input data before insertion
- Sanitize username inputs to prevent XSS when displaying

## Monitoring

### Key Metrics to Track
- Connection pool usage
- Query execution time
- Table sizes and growth rate
- Index usage statistics
- Dead tuple ratio for vacuum tuning

### Health Checks
```sql
-- Check database size
SELECT pg_database_size('claude_code_stats') / 1024 / 1024 as size_mb;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC
LIMIT 10;
```
