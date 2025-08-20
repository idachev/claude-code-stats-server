# Dashboard Views Documentation

## Overview

The Claude Code Stats Server provides interactive HTML dashboards for visualizing usage statistics. These views are built using server-side rendering with EJS templates and client-side charting with Chart.js.

## Architecture

### View System Components

1. **Router** (`/src/api/views/viewsRouter.ts`)
   - Handles HTTP requests for dashboard pages
   - Processes query parameters for filtering
   - Fetches data from the stats service
   - Renders EJS templates with processed data

2. **Templates** (`/src/views/`)
   - `layouts/base.ejs` - Base HTML layout with CDN imports
   - `partials/dashboard-content.ejs` - Main dashboard content
   - `partials/error-content.ejs` - Error page content
   - `dashboard.ejs` - Dashboard page wrapper
   - `error.ejs` - Error page wrapper

3. **Middleware** (`/src/common/middleware/helmetConfig.ts`)
   - Content Security Policy configuration
   - Allows CDN resources for Tailwind and Chart.js

## Dashboard Features

### Main Dashboard (`/dashboard`)

#### Query Parameters
- `period` - Time range filter
  - `week` (default) - Last 7 days
  - `month` - Current month
  - `all` - All available data
- `user` - Filter by specific username
- `groupBy` - Data grouping (future enhancement)
  - `user` - Group by user
  - `model` - Group by model
  - `date` - Group by date

#### Charts and Visualizations

1. **Daily Usage Bar Chart**
   - Stacked bar chart showing daily costs
   - Each stack represents a different user
   - Hover tooltips show user-specific costs
   - Consistent color mapping per user

2. **Total Token Cost Donut Chart**
   - Breakdown of total costs by user
   - Shows percentage distribution
   - Interactive tooltips with exact values

3. **Input Token Cost Donut Chart**
   - User distribution of input token costs
   - Helps identify heavy input users

4. **Output Token Cost Donut Chart**
   - User distribution of output token costs
   - Helps identify heavy output users

#### Data Processing

The view router processes raw statistics data for chart consumption:

```typescript
interface DailyAccumulator {
  [date: string]: {
    [user: string]: number;
  };
}

// Process data for stacked bar chart
const processedData = stats.dailyStats.reduce((acc, day) => {
  const dateStr = formatDate(day.date);
  day.modelStats.forEach(stat => {
    if (!acc[dateStr]) acc[dateStr] = {};
    if (!acc[dateStr][stat.user]) acc[dateStr][stat.user] = 0;
    acc[dateStr][stat.user] += stat.totalCost;
  });
  return acc;
}, {} as DailyAccumulator);
```

## Styling and Theme

### Dark Theme
The dashboard uses a dark theme optimized for developer environments:
- Background: `#1a1a1a` (dark-bg)
- Cards: `#2a2a2a` (dark-card)
- Borders: `#3a3a3a` (dark-border)
- Text: Light gray (`text-gray-100`)

### Responsive Design
- Tailwind CSS utilities for responsive layouts
- Mobile-friendly card grids
- Adaptive chart sizing

## Chart Configuration

### Chart.js Setup
Charts are configured with dark theme defaults:

```javascript
Chart.defaults.color = '#9CA3AF'; // Light gray text
Chart.defaults.borderColor = '#3a3a3a'; // Dark borders
```

### Color Palette
Consistent color mapping for users across all charts:

```javascript
const colors = [
  'rgb(59, 130, 246)',  // Blue
  'rgb(16, 185, 129)',  // Green
  'rgb(251, 146, 60)',  // Orange
  'rgb(244, 63, 94)',   // Red
  'rgb(168, 85, 247)',  // Purple
  'rgb(251, 207, 232)', // Pink
  'rgb(251, 191, 36)',  // Yellow
  'rgb(34, 197, 94)'    // Emerald
];
```

## Content Security Policy

The application uses Helmet with a custom CSP configuration that allows:

### Script Sources
- `'self'` - Same origin scripts
- `'unsafe-inline'` - Required for Chart.js initialization
- `'unsafe-eval'` - Required for Tailwind CSS runtime
- `https://cdn.tailwindcss.com` - Tailwind CSS
- `https://cdn.jsdelivr.net` - Chart.js and adapters

### Style Sources
- `'self'` - Same origin styles
- `'unsafe-inline'` - Required for Tailwind utilities

## Rate Limiting

Rate limiting is automatically disabled in development mode to facilitate testing:

```typescript
skip: () => env.isTest || env.isDevelopment
```

## Error Handling

### Error View (`/error`)
- Displays user-friendly error messages
- Shows error details in development mode
- Maintains consistent dark theme styling

### Error Middleware
Errors are caught and rendered using the error view:

```typescript
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  res.status(statusCode).render('error', {
    message: err.message,
    error: env.isDevelopment ? err : {}
  });
});
```

## Development Workflow

### Adding New Views

1. Create the EJS template in `/src/views/`
2. Add route handler in `/src/api/views/viewsRouter.ts`
3. Process data for chart consumption
4. Include proper error handling
5. Test with different query parameters

### Testing Views

1. Start development server: `pnpm start:dev`
2. Navigate to `http://localhost:8080/dashboard`
3. Test different filter combinations
4. Check browser console for JavaScript errors
5. Verify CSP isn't blocking resources

### Formatting EJS Templates

EJS templates are formatted using JS-Beautify:

```bash
pnpm format:ejs
```

Configuration is in `.jsbeautifyrc`:
- Tab-based indentation
- Preserves template tags
- HTML-aware formatting

## Performance Considerations

### Server-Side Processing
- Data aggregation happens on the server
- Reduces client-side JavaScript payload
- Improves initial page load time

### CDN Resources
- Tailwind and Chart.js loaded from CDN
- Leverages browser caching
- Reduces server bandwidth

### Chart Optimization
- Responsive charts with `maintainAspectRatio: false`
- Efficient data structures for Chart.js
- Minimal DOM manipulation

## Future Enhancements

### Planned Features
- Real-time data updates via WebSockets
- Export charts as images
- Custom date range selection
- Model-specific cost breakdown views
- User comparison views
- Cost prediction based on trends

### Technical Improvements
- Move to build-time CSS compilation
- Implement chart data caching
- Add chart animations
- Progressive enhancement for no-JS support