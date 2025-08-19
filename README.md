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
- **PostgreSQL database** with TypeORM for data persistence
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
- **TypeORM** - Database ORM
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
5. Run migrations: `npm run migration:run`
6. Start development server: `npm run start:dev`

The PostgreSQL database will be available at `localhost:9099` with:
- User: `localdev`
- Password: (see `utils/docker-compose/docker-secrets/db-password`)
- Database: `claude_code_stats`

## Development

- `npm run start:dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run migration:generate -- -n MigrationName` - Generate new migration
- `npm run test` - Run tests

## License

MIT