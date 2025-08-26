# Admin API Documentation

## Overview

The Admin API provides comprehensive user management capabilities for the Claude Code Stats Server. All admin endpoints require authentication via either session cookies (for the web dashboard) or API key headers (for programmatic access).

## Authentication

### Methods

1. **Session-based** (for web dashboard)
   - Login at `/dashboard/admin` with Basic Auth
   - Username: `admin`
   - Password: Your `ADMIN_API_KEY` value

2. **API Key Header** (for programmatic access)
   - Header: `X-Admin-Key: <your-admin-api-key>`

## User Management Endpoints

### GET /admin/users

Retrieve a paginated list of users with optional filtering and sorting.

**Query Parameters:**
- `search` (string) - Search users by username (case-insensitive partial match)
- `tags` (string[]) - Filter users by tags (AND operation for multiple tags)
- `page` (integer) - Page number (default: 1)
- `limit` (integer) - Items per page (default: 20, max: 100)
- `sortBy` (string) - Sort field: "username", "createdAt", or "updatedAt" (default: "createdAt")
- `order` (string) - Sort order: "asc" or "desc" (default: "desc")

**Response:**
```json
{
  "users": [
    {
      "id": 1,
      "username": "developer1",
      "tags": ["frontend", "react"],
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  },
  "filters": {
    "search": "dev",
    "tags": ["frontend"]
  }
}
```

**Examples:**
```bash
# Search for users with "dev" in username
curl -H "X-Admin-Key: your-key" \
  "http://localhost:3000/admin/users?search=dev"

# Filter by tags (users must have ALL specified tags)
curl -H "X-Admin-Key: your-key" \
  "http://localhost:3000/admin/users?tags=frontend&tags=react"

# Paginated results sorted by username
curl -H "X-Admin-Key: your-key" \
  "http://localhost:3000/admin/users?page=2&limit=10&sortBy=username&order=asc"
```

### GET /admin/users/:username

Get detailed information about a specific user.

**Response:**
```json
{
  "id": 1,
  "username": "developer1",
  "tags": ["frontend", "react", "typescript"],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### POST /admin/users

Create a new user with an API key.

**Request Body:**
```json
{
  "username": "developer2",
  "tags": ["backend", "nodejs"]  // Optional
}
```

**Response:**
```json
{
  "username": "developer2",
  "apiKey": "ccs_1234567890abcdef...",
  "message": "User created successfully. Please store the API key securely as it won't be shown again."
}
```

### POST /admin/users/:username/api-key/regenerate

Regenerate a user's API key. The old key becomes invalid immediately.

**Response:**
```json
{
  "username": "developer1",
  "apiKey": "ccs_fedcba0987654321...",
  "message": "API key regenerated successfully. Please store it securely as it won't be shown again."
}
```

### POST /admin/users/:username/api-key/check

Validate a user's API key.

**Request Body:**
```json
{
  "apiKey": "ccs_1234567890abcdef..."
}
```

**Response:**
```json
{
  "username": "developer1",
  "isValid": true
}
```

### POST /admin/users/:username/deactivate

Deactivate a user by regenerating their API key, effectively blocking access.

**Response:**
```json
{
  "message": "User developer1 has been deactivated. The API key has been regenerated and the old key is no longer valid."
}
```

## Tag Management Endpoints

### GET /admin/users/:username/tags

Get all tags for a specific user.

**Response:**
```json
{
  "username": "developer1",
  "tags": ["frontend", "react", "typescript"]
}
```

### POST /admin/users/:username/tags

Add tags to a user (existing tags are preserved).

**Request Body:**
```json
{
  "tags": ["vue", "nuxt"]
}
```

### PUT /admin/users/:username/tags

Replace all tags for a user.

**Request Body:**
```json
{
  "tags": ["backend", "python", "django"]
}
```

### DELETE /admin/users/:username/tags/:tagName

Remove a specific tag from a user.

## Session Management

### POST /admin/logout

Destroy the current admin session.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## Error Responses

All endpoints return appropriate HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing or invalid authentication)
- `404` - Not Found
- `409` - Conflict (e.g., duplicate user)
- `500` - Internal Server Error

Error response format:
```json
{
  "error": "Error message",
  "status": 400,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Rate Limiting

Login attempts are rate-limited to 5 attempts per 15 minutes per IP address.

## Best Practices

1. **API Key Security**: Store API keys securely and never expose them in client-side code
2. **Pagination**: Use pagination for large user lists to improve performance
3. **Tag Filtering**: When filtering by multiple tags, users must have ALL specified tags
4. **Search**: Search is case-insensitive and matches partial usernames
5. **Session Timeout**: Admin sessions expire after 15 minutes of inactivity