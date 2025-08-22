# Task: Add User Tags with Dashboard Filtering

## Overview

Implement a tagging system for users with one-to-many relationship (each tag belongs to one user),
allowing multiple tags per user and dashboard filtering by tags.

## 1. Database Schema Changes

### New Tables

```sql
-- Tags table (one-to-many relationship with users)
tags
( id: serial primary key,
    user_id: integer not null references users(id) on delete cascade,
    name : varchar (64) not null, -- Max 64 chars, allows [A-Za-z .-_]
    created_at: timestamp with time zone default now(),
    CONSTRAINT unique_user_tag_name_ci UNIQUE (user_id, LOWER(name)) -- Case-insensitive unique per user
)
```

### Migration Steps

1. Update existing tables to use `timestamp with time zone`:
    - Update `users` table: `created_at`, `updated_at`
    - Update `usage_stats` table: `timestamp`, `created_at`
    - Any other timestamp columns in existing tables
2. Create new schema for tags in `/src/db/schema.ts`
3. Generate migration: `pnpm db:generate`
4. Apply migration: `pnpm db:migrate`

## 2. API Endpoints

### Admin User-Tag Association

- `GET /admin/users/:userId/tags` - Get tags for a specific user
- `POST /admin/users/:userId/tags` - Assign/create tags for user (can create new tag inline)
- `PUT /admin/users/:userId/tags` - Update/replace all tags for user
- `DELETE /admin/users/:userId/tags/:tagId` - Remove specific tag from user

### User Endpoints (Updated)

- `GET /admin/users/:userId` - Returns user with `tags` array in response DTO
- `GET /admin/users` - Returns users with `tags` array in each user DTO
- Tags included in UserDto as: `tags: Tag[]`

### Stats Filtering

- Update `GET /claude-code-stats` to accept `tags[]` query parameter for filtering by tag names
- Modify StatsService to filter results based on users with specified tags

## 3. Service Layer Changes

### TagService (`/src/api/tags/tagService.ts`)

```typescript
class TagService {
  // Get all unique tag names in the system
  async getTags(): Promise<string[]>  // Get all unique tag names in system

  // User tag operations
  async setUserTags(userId: number, tags: string[]): Promise<void>  // Replace all user tags
  async getUserTags(userId: number): Promise<string[]>  // Get tag names for user
  async removeTagFromUser(userId: number, tagName: string): Promise<void>

  async getUsersByTag(tagName: string): Promise<User[]>  // Get all users with a specific tag
}
```

### UserService Updates

- Add `tags: string[]` field to UserDto and UserResponseDto
- Include tags in `getUserById` method response
- Include tags in `getUsers` method response (for each user)
- Add eager loading for tags when fetching users (JOIN with user_tags and tags)
- Ensure tags are always included in user responses

### StatsService Updates

- Modify queries to JOIN with user_tags when tagIds filter is provided
- Add tag filtering to all aggregation queries
- Ensure performance with proper indexes

## 4. Dashboard UI Changes

### Tag Display (Read-only)

- Show tags as simple text badges in existing views
- Display all unique tags in filter dropdowns
- Show usage count for each tag in filters

### Dashboard Filtering

- Add tag filter dropdown/multiselect to existing stats views
- Persist filter selections in URL query params
- Show active filters as removable chips

### Components to Create/Update

```
/src/views/
└── partials/
    ├── tag-filter.ejs   # Reusable filter component for existing views
    └── tag-badges.ejs   # Display tags as simple badges
```

## 5. Data Models & DTOs

### TypeScript Interfaces

```typescript
// Updated User DTOs
interface UserDto {
  id: number;
  name: string;
  email: string;
  apiKey: string;
  tags: string[];  // Simple string array
  createdAt: Date;
  updatedAt: Date;
}

interface UserResponseDto {
  id: number;
  name: string;
  email: string;
  apiKey: string;
  tags: string[];  // Simple string array
  totalUsage?: number;
  lastActivity?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface AssignTagsDto {
  tags: string[];  // Simple array of tag names
}

// Used as request body for:
// - POST /admin/users/:userId/tags (assign/create tags)
// - PUT /admin/users/:userId/tags (replace all tags)
// Example: { "tags": ["development", "frontend", "team-alpha"] }
```

## 6. Database Indexes

Add indexes for performance:

```sql
CREATE INDEX idx_tags_user_id ON tags (user_id);
CREATE INDEX idx_tags_name ON tags (name);
CREATE INDEX idx_tags_user_id_name ON tags (user_id, name);
```

## 7. Implementation Order

### Phase 0: Update Existing Timestamps

1. Modify all existing timestamp columns to use `timestamp with time zone`
2. Update Drizzle schema definitions for existing tables
3. Generate and apply migration for timestamp changes

### Phase 1: Database & Core API

1. Create database schema for tags and user_tags
2. Implement TagService with basic operations
3. Create tag management API endpoints
4. Register endpoints in Swagger

### Phase 2: User-Tag Association

1. Implement user-tag association methods
2. Update UserService to include tags
3. Create association API endpoints
4. Update user DTOs and responses

### Phase 3: Stats Integration

1. Update StatsService queries for tag filtering
2. Modify stats endpoints to accept tag filters
3. Update aggregation logic
4. Test performance with large datasets

### Phase 4: Dashboard UI

1. Add tag display to existing views (show tags as badges)
2. Implement tag filtering in dashboard
3. Add tag filter dropdown to stats views

### Phase 5: Testing & Optimization

1. Add unit tests for TagService
2. Add integration tests for API endpoints
3. Performance testing with multiple tags
4. Add database indexes if needed

## 8. Security & Validation Considerations

- Validate tag names: only allow [0-9A-Za-z .-_] characters
- Limit tag name length to 64 characters
- Prevent duplicate tag names (case-insensitive) globally
- Prevent duplicate tags per user (same tag can't be assigned twice to one user)
- Trim whitespace from tag names
- Validate tag name format before database insertion
- Ensure unique constraint on user_tags (user_id, tag_id) primary key

## 9. Migration & Rollback Plan

### Migration

1. Deploy database changes first
2. Deploy API changes (backward compatible)
3. Deploy UI changes
4. Populate initial tags if needed

### Rollback

1. UI can be rolled back independently
2. API maintains backward compatibility
3. Database rollback via migration reversal
4. Keep user_tags data for recovery

## 10. Performance Considerations

- Use database transactions for bulk tag assignments
- Consider pagination for users-by-tag queries
- Use JOIN queries efficiently to avoid N+1 problems
- Index foreign keys and commonly filtered columns

## 12. Acceptance Criteria

- [ ] Users can have multiple tags assigned
- [ ] Tags can be created, updated, and deleted
- [ ] Dashboard can filter by one or more tags
- [ ] Tag assignments are tracked with timestamp
- [ ] API endpoints are documented in Swagger
- [ ] Performance remains acceptable with 100+ tags
- [ ] UI displays tags with colors and badges
- [ ] Tag filtering persists across page refreshes
