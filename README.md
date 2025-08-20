# Claude Code Stats Server

A simple server for collecting and visualizing Claude Code usage statistics.

## Overview

This server collects usage data from the `ccusage` command-line tool and displays beautiful statistics dashboards showing:
- Daily token usage and costs
- Model usage breakdown
- User statistics
- Weekly/monthly aggregations

## Features

- **REST API** for uploading usage statistics
- **PostgreSQL database** with Drizzle ORM for data persistence
- **Server-rendered HTML dashboards** using EJS templates
- **Beautiful charts** showing usage trends over time
- **User and model filtering** for detailed analysis

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /claude-code-stats?username=<username>` - Upload usage statistics JSON
- `GET /claude-code-stats` - View statistics dashboard

## Tech Stack

- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Drizzle ORM** - Lightweight, type-safe ORM with SQL-like syntax
- **PostgreSQL** - Database
- **EJS** - Server-side templating
- **Chart.js** - Data visualization
- **Tailwind CSS** - Styling

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

## Development

- `pnpm start:dev` - Start development server with hot reload
- `pnpm build` - Build for production
- `pnpm db:generate` - Generate new migration from schema changes
- `pnpm db:migrate` - Apply migrations to database
- `pnpm db:studio` - Open Drizzle Studio for database GUI
- `pnpm test` - Run tests

## License

MIT