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
- **Interactive HTML dashboards** with dark theme UI
- **Real-time charts** using Chart.js for data visualization
- **User and model filtering** for detailed analysis
- **Stacked bar charts** showing daily usage breakdown by user
- **Donut charts** for cost distribution analysis
- **Responsive design** with Tailwind CSS

## Endpoints

### API Endpoints
- `GET /health` - Health check endpoint
- `POST /claude-code-stats?username=<username>` - Upload usage statistics JSON
- `GET /api/claude-code-stats` - Get statistics data as JSON (with optional filters)

### Dashboard Views
- `GET /dashboard` - Interactive statistics dashboard with charts
  - Query parameters:
    - `period`: `week` (default), `month`, or `all`
    - `user`: Filter by specific username
    - `groupBy`: Group data by `user`, `model`, or `date`
- `GET /error` - Error page for handling exceptions

## Tech Stack

### Core
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **PostgreSQL** - Database
- **Drizzle ORM** - Lightweight, type-safe ORM with SQL-like syntax

### Frontend
- **EJS** - Server-side templating
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

## Development

### Commands
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

## Dashboard Features

The dashboard (`/dashboard`) provides:
- **Daily Usage Chart**: Stacked bar chart showing token costs per user
- **Cost Distribution**: Donut charts for total, input, and output token costs
- **User Breakdown**: See individual user contributions to total costs
- **Time Period Filters**: View last week, current month, or all-time data
- **User Filters**: Focus on specific user's usage patterns

## Configuration

### Environment Variables
See `.env.template` for required environment variables.

### Content Security Policy
The application uses Helmet for security with a configured CSP that allows:
- CDN resources for Tailwind CSS and Chart.js
- Inline scripts for Chart.js initialization
- Inline styles for Tailwind utility classes

Configuration is in `/src/common/middleware/helmetConfig.ts`.

## License

MIT