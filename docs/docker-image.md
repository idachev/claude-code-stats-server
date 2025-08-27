# Docker Image

## Docker Hub

The official Docker image is available at: [idachev/claude-code-stats-server](https://hub.docker.com/r/idachev/claude-code-stats-server/tags)

## Quick Start

### Using Docker Run

```bash
docker run -d \
  --name claude-stats-server \
  -p 3000:3000 \
  -e DB_HOST="your-postgres-host" \
  -e DB_PORT="5432" \
  -e DB_NAME="claude_code_stats" \
  -e DB_USER="postgres" \
  -e DB_PASSWORD="your-db-password" \
  -e ADMIN_API_KEY="your-admin-key" \
  -e NODE_ENV="production" \
  idachev/claude-code-stats-server:latest
```

### Using Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: claude_code_stats
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secretpassword
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d claude_code_stats"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Run migrations automatically
  migrate:
    image: idachev/claude-code-stats-server:latest
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: claude_code_stats
      DB_USER: postgres
      DB_PASSWORD: secretpassword
    depends_on:
      postgres:
        condition: service_healthy
    command: ["pnpm", "db:migrate"]
    restart: "no"

  stats-server:
    image: idachev/claude-code-stats-server:latest
    ports:
      - "3000:3000"
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: claude_code_stats
      DB_USER: postgres
      DB_PASSWORD: secretpassword
      ADMIN_API_KEY: your-admin-key
      NODE_ENV: production
    depends_on:
      migrate:
        condition: service_completed_successfully

volumes:
  postgres_data:
```

Then run:
```bash
docker-compose up -d
```

The setup now includes automatic database migrations that run before the application starts.

## Environment Variables

### Required Variables

- `DB_HOST` - PostgreSQL host (e.g., `postgres` for Docker network, `localhost` for local)
- `DB_PORT` - PostgreSQL port (default: `5432`)
- `DB_NAME` - Database name (default: `claude_code_stats`)
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password
- `ADMIN_API_KEY` - Admin API key for user management (use a strong, random key in production)

### Optional Variables

- `NODE_ENV` - Environment mode (`development` or `production`, default: `development`)
- `PORT` - Server port (default: `3000`)
- `HOST` - Server host (default: `localhost`)
- `CORS_ORIGIN` - CORS allowed origins. Supports single or multiple (comma-separated) URLs, or `*` for all origins (default: `http://localhost:3000`)
- `COMMON_RATE_LIMIT_WINDOW_MS` - Rate limit window in milliseconds (default: `1000`)
- `COMMON_RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: `20`)
- `DB_MAX_CONNECTIONS` - Max database connections (default: `20`)
- `LOG_LEVEL` - Logging level (default: `debug`)
- `STATS_RETENTION_DAYS` - Days to retain stats (default: `90`, not currently implemented)
- `DEFAULT_PERIOD` - Default dashboard period (default: `week`)

## Available Tags

- `latest` - Latest stable release
- `vX.Y.Z` - Specific version tags (e.g., `v0.1.0`, `v0.1.1`)

## Building Your Own Image

To build the Docker image locally:

```bash
# Clone the repository
git clone https://github.com/idachev/claude-code-stats-server.git
cd claude-code-stats-server

# Build the image
docker build -t claude-code-stats-server .

# Run locally
docker run -p 3000:3000 \
  -e DATABASE_URL="your-database-url" \
  -e ADMIN_KEY="your-admin-key" \
  claude-code-stats-server
```

## Automated Builds

The Docker image is automatically built and pushed to Docker Hub:
- On every push to the `release` branch
- Can be manually triggered via GitHub Actions
- Version tags are automatically incremented

See [GitHub Actions Workflow](../.github/workflows/docker-build-push.yml) for details.

## Security Considerations

1. **Database Credentials**: Never expose database credentials in logs or error messages
2. **Admin Key**: Use a strong, randomly generated admin key
3. **Network Security**: Consider using Docker networks to isolate services
4. **Volume Permissions**: Ensure proper permissions on mounted volumes
5. **Update Regularly**: Pull the latest image regularly for security updates

## Troubleshooting

### Container Won't Start
- Check logs: `docker logs claude-stats-server`
- Verify DATABASE_URL is correct and database is accessible
- Ensure all required environment variables are set

### Database Connection Issues
- Verify PostgreSQL is running and accessible
- Check network connectivity between containers
- Ensure database exists and user has proper permissions

### Permission Denied Errors
- Check file permissions in mounted volumes
- Ensure the container user has necessary permissions

## Resource Requirements

Minimum recommended resources:
- CPU: 0.5 cores
- Memory: 256MB
- Storage: 100MB (excluding database)

Production recommended:
- CPU: 1-2 cores
- Memory: 512MB-1GB
- Storage: 1GB (excluding database)