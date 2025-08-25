# Task: User Management Admin UI

## Overview

Build a secure admin dashboard interface for managing users, including CRUD operations,
API key management, and tag management. The admin area will be protected with Basic Auth using
the existing admin API key and follow the same design theme as the public dashboard.

## 1. Authentication & Security

### Dashboard Authentication (Basic Auth + Session)

- Use the existing `ADMIN_API_KEY` from environment variables
- Implement Basic Auth middleware for `/dashboard/admin` route
- Username: `admin`
- Password: The `ADMIN_API_KEY` value
- On successful auth:
    - Create server-side session using express-session
    - Regenerate session ID to prevent session fixation attacks
    - Set secure, httpOnly, sameSite session cookie
    - Session contains: `{ isAdmin: true, loginTime: Date, lastActivity: Date }`
- Return 401 Unauthorized for invalid credentials
- Implement rate limiting (5 attempts per 15 minutes)

### API Authentication (Session + Header Support)

- REST API endpoints at `/admin/*` support BOTH:
    1. **Session Cookie** (for browser calls from admin dashboard)
        - Check for valid session cookie
        - Verify session has `isAdmin: true`
        - Auto-renew session on activity
    2. **Header Auth** (for programmatic/API access)
        - Header: `X-Admin-Key: <ADMIN_API_KEY>` (existing header name)
        - Maintains backward compatibility for existing integrations
- Middleware checks for either auth method and accepts if valid
- Return 401 Unauthorized if both are missing or invalid

### Middleware Structure

```typescript
// /src/common/middleware/adminDashboardAuth.ts - For dashboard route
export const adminDashboardAuth = (req, res, next) => {
  const adminApiKey = process.env.ADMIN_API_KEY;
  
  // Check Basic Auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
    return res.status(401).send('Authentication required');
  }
  
  const base64 = authHeader.split(' ')[1];
  const [username, password] = Buffer.from(base64, 'base64').toString().split(':');
  
  if (username === 'admin' && password === adminApiKey) {
    // Create session
    req.session.isAdmin = true;
    req.session.loginTime = new Date();
    return next();
  }
  
  res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
  res.status(401).send('Invalid credentials');
}

// /src/common/middleware/adminApiAuth.ts - Enhanced existing middleware
// Currently uses 'x-admin-key' header, will add session support
export const adminApiAuth = (req, res, next) => {
  const adminApiKey = process.env.ADMIN_API_KEY;
  
  // Check session first (for browser requests)
  if (req.session && req.session.isAdmin) {
    // Renew session activity
    req.session.lastActivity = new Date();
    return next();
  }
  
  // Check API Key header (for programmatic access)
  // Note: existing code uses 'x-admin-key' not 'x-admin-api-key'
  const apiKeyHeader = req.headers['x-admin-key'];
  if (apiKeyHeader === adminApiKey) {
    return next();
  }
  
  // Neither auth method succeeded
  res.status(401).json({ error: 'Unauthorized' });
}
```

## 2. Admin Dashboard Layout

### Route Structure

```
/dashboard/admin - Single server-rendered EJS page with full admin UI
```

- Only ONE route that serves the complete admin dashboard
- Server-side rendering using internal services (UserService, TagService)
- No additional view routes needed - everything is in one SPA-like page
- Client-side JavaScript handles UI interactions and calls existing REST APIs

### Base Layout (`/src/views/layouts/admin-base.ejs`)

- Inherit styling from existing `/dashboard` theme
- Add left sidebar navigation
- Keep consistent header/footer with admin indicator
- Use same Tailwind CSS configuration
- Load data via internal services on initial render (no API calls)

### Left Sidebar Navigation

```html
<nav class="w-64 bg-gray-800 h-screen fixed left-0">
  <div class="p-4">
    <h2>Admin Panel</h2>
    <ul class="menu">
      <li><a href="/admin/users" class="active">Users</a></li>
      <!-- Future menu items -->
    </ul>
    <div class="absolute bottom-4 left-4 right-4">
      <div class="text-xs text-gray-400 mb-2">
        Session expires in: <span id="session-timer">15:00</span>
      </div>
      <button id="logout-btn" class="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">
        Logout
      </button>
    </div>
  </div>
</nav>
```

## 3. Users Management View

### Single Page Application (`/src/views/dashboard/admin.ejs`)

- Single EJS file that contains the entire admin interface
- Initial data loaded server-side via UserService and TagService
- Client-side JavaScript manages all interactions

#### Features

1. **User Table Display**
    - Columns: ID, Username, Tags, Created At, Updated At, Actions
    - Sortable columns (Username, Created At, Updated At)
    - Pagination (20 users per page)

2. **Search & Filter Bar**
    - Search by username (partial match)
    - Filter by tags (multi-select dropdown)
    - Clear filters button
    - Real-time search with debouncing (300ms)

3. **Action Buttons per User**
    - Regenerate API Key (with confirmation)
    - Manage Tags inline - ability to add/remove tags
    - Delete User (with confirmation, soft delete preferred)

4. **Bulk Actions**
    - Select multiple users
    - Bulk add/remove tags 
    - Bulk delete (with strong confirmation)

### Create User Modal/Form

```typescript
interface CreateUserForm {
  username: string;    // Required, min 3 chars
  tags?: string[];     // Optional, select existing or create new
}
```

### API Key Management

- Display: Cannot show API keys (they're hashed in DB)
- Regenerate: Confirmation modal → New key displayed once → Copy button with visual feedback
- Copy to clipboard: Use Clipboard API with fallback for older browsers
- Security: API key only visible on creation/regeneration, never retrievable again
- Visual feedback: Show "Copied!" message and change button color on successful copy

```javascript
// Copy API key to clipboard with feedback
async function copyApiKey(apiKey, buttonElement) {
  try {
    await navigator.clipboard.writeText(apiKey);
    buttonElement.textContent = 'Copied!';
    buttonElement.classList.add('bg-green-600');
    setTimeout(() => {
      buttonElement.textContent = 'Copy';
      buttonElement.classList.remove('bg-green-600');
    }, 2000);
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = apiKey;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
}
```

### Tag Management Interface

1. **Inline Tag Editor**
    - Display current tags as removable chips
    - Add tag via dropdown (existing) or text input (new)
    - Remove tag with X button on chip
    - Save/Cancel buttons

2. **Tag Autocomplete**
    - Show existing tags as user types
    - Allow creating new tags if not found
    - Validate tag format: [0-9A-Za-z .-_], min 2 and max 64 chars

## 4. Server-Side Data Loading & API Usage

### Initial Page Load (Server-Side)

```typescript
// In /src/api/views/adminViewRouter.ts
adminViewRouter.get("/dashboard/admin", adminDashboardAuth, async (req, res) => {
  // Use internal services directly - no API calls
  const users = await userService.getUsers();
  const tags = await tagService.getTags();

  res.render("dashboard/admin", {
    initialData: {
      users,
      tags,
      // Other initial data
    }
  });
});
```

### Client-Side API Calls (Existing Endpoints)

```typescript
// Existing admin endpoints (currently uses X-Admin-Key header, will support session too)
GET    /admin/users                              // Get all users
GET    /admin/users/:username                    // Get user by username
POST   /admin/users                              // Create new user (body: { username, tags? })
                                                  // NOTE: tags parameter needs to be added to existing API
POST   /admin/users/:username/api-key/regenerate // Regenerate API key
POST   /admin/users/:username/api-key/check      // Validate API key (body: { apiKey })

// Session management endpoints (new)
POST   /admin/logout                             // Destroy session and redirect to login

// New endpoints needed (from task-20250822-add-tags.md)
DELETE /admin/users/:username                    // Delete user
GET    /admin/tags                               // Get all unique tags in system
POST   /admin/users/:username/tags               // Add tags to user
PUT    /admin/users/:username/tags               // Replace all user tags
DELETE /admin/users/:username/tags/:tagId        // Remove specific tag from user

// Features needed but not yet implemented:
// - Search/filter on GET /admin/users (add query params: search, tags[], page, limit, sort)
// - Pagination support on GET /admin/users
// - Extension of POST /admin/users to accept optional tags array
```

### Response DTOs (Using Existing Models)

```typescript
// Existing User model from /api/user/userModel.ts
interface User {
  id: number;
  username: string;
  tags: string[];       // Will be added with tags feature
  createdAt: Date;
  updatedAt: Date;
}

// API key is only returned on creation/regeneration
interface ApiKeyResponse {
  username: string;
  apiKey: string;       // Raw API key - only shown once
  message: string;
}

// For user list with pagination (to be implemented)
interface UsersListResponse {
  users: User[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters?: {
    search?: string;
    tags?: string[];
  };
}

// Note: API keys are hashed in DB - cannot be retrieved after creation
// Usage stats would need to be fetched separately from usage_stats table if needed
```

## 5. Frontend Components

### Single Page Structure

All components are embedded in `/src/views/dashboard/admin.ejs`:

- Left sidebar navigation (embedded)
- User table with inline actions
- Modals for create/edit/confirm operations
- Tag management UI (inline editing)
- All handled by client-side JavaScript

### JavaScript Modules (Inline in admin.ejs or separate files)

```javascript
// Admin API client - relies on session cookie for auth
class AdminApiClient {
  constructor() {
    // Session cookie is automatically sent by browser
    this.headers = {
      'Content-Type': 'application/json'
      // credentials: 'same-origin' ensures cookies are sent
    };
  }

  async loadUsers(filters = {}) {
    // Call GET /admin/users with filters
    // Browser automatically includes session cookie
    return fetch('/admin/users?' + new URLSearchParams(filters), {
      credentials: 'same-origin', // Include cookies
      headers: this.headers
    });
  }

  async createUser(userData) {
    // Call POST /admin/users
  }

  async regenerateApiKey(userId) {
    // Call POST /admin/users/:id/regenerate-key
  }

  async updateUserTags(userId, tags) {
    // Call PUT /admin/users/:userId/tags
  }

  async deleteUser(userId) {
    // Call DELETE /admin/users/:id
  }
}

// UI Manager - handles DOM updates and user interactions
class AdminUIManager {
  constructor(apiClient, initialData) {
    this.api = apiClient;
    this.users = initialData.users;
    this.tags = initialData.tags;
    this.initEventListeners();
  }

  // UI update methods
  renderUserTable() {
  }

  showCreateUserModal() {
  }

  showTagEditor(userId) {
  }

  // etc.
}
```

## 6. UI/UX Specifications

### Design Theme

- Use existing dashboard's Tailwind configuration
- Dark header/sidebar with light content area
- Consistent with public `/dashboard` styling
- Responsive design (mobile-friendly tables)

### Color Scheme

```css
/* Admin-specific overrides */
.admin-header {
  background: #1a202c;
}

/* Darker than public */
.admin-sidebar {
  background: #2d3748;
}

.admin-badge {
  background: #e53e3e;
}

/* Red admin indicator */
```

### Interactive Elements

- Loading states for all async operations
- Success/error toast notifications
- Confirmation modals for destructive actions
- Inline form validation with error messages
- Keyboard shortcuts (Ctrl+N for new user, etc.)

## 7. API Extensions Required

### Extend POST /admin/users Endpoint

The existing `POST /admin/users` endpoint currently only accepts `username`. It needs to be extended to accept optional tags:

**Current Implementation:**
```typescript
// src/api/user/userModel.ts
export const CreateUserSchema = z.object({
  body: z.object({
    username: UsernameSchema,
  }),
});
```

**Required Extension:**
```typescript
// src/api/user/userModel.ts
import { TagNameSchema } from "@/api/tags/tagSchemas"; // Import existing tag validation

export const CreateUserSchema = z.object({
  body: z.object({
    username: UsernameSchema,
    tags: z.array(TagNameSchema).optional(), // Reuse existing TagNameSchema for validation
  }),
});
```

**Implementation Changes Needed:**
1. Update `CreateUserSchema` in `userModel.ts` to include optional tags using existing `TagNameSchema`
2. Modify `userController.createUser` to extract and pass tags to the service
3. Update `ApiKeyService.createUserWithApiKey` method to:
   - Accept tags as optional parameter
   - Save tags along with user creation in a transaction
   - Use existing `tagService.addTagsToUser` or create tags in transaction
4. Tag validation automatically handled by existing `TagNameSchema`:
   - Pattern: [0-9A-Za-z .-_]
   - Min length: 2 chars (TAG_MIN_LENGTH)
   - Max length: 64 chars (TAG_MAX_LENGTH)
   - Auto-trimming of whitespace

**Benefits of Single API Call:**
- Atomic operation - user and tags created together
- Better user experience - no need for multiple API calls
- Reduced latency and potential for partial failures
- Simpler error handling in the UI

## 8. Implementation Phases

### Phase 1: Session Setup & Authentication

1. Install and configure express-session with PostgreSQL store (connect-pg-simple)
2. Configure CSRF protection middleware (csurf or similar)
3. Create Basic Auth middleware for `/dashboard/admin`
4. Implement session regeneration on successful auth
5. Create logout endpoint `/admin/logout`
6. Update admin API middleware to check session
7. Create single route handler in adminViewRouter
8. Add rate limiting for login attempts

### Phase 2: Server-Side Rendering

1. Load users via UserService on initial render
2. Load tags via TagService on initial render
3. Pass data to EJS template
4. Render initial user table server-side

### Phase 3: Client-Side JavaScript

1. Implement AdminApiClient with fetch (credentials: 'same-origin')
2. Create AdminUIManager for DOM manipulation
3. Add event listeners for user interactions
4. Session cookie automatically included in API calls

### Phase 4: User CRUD Operations

1. Implement create user modal/form
2. Wire up to existing POST /admin/users endpoint
3. Add edit user functionality
4. Implement delete with confirmation

### Phase 5: API Key & Tag Management

1. Secure API key display (masked)
2. Regenerate key with existing endpoint
3. Inline tag editor using existing tag endpoints
4. Tag autocomplete from initial data

### Phase 6: Polish & Testing

1. Add loading states
2. Implement error handling
3. Add success notifications
4. Mobile responsiveness
5. Cross-browser testing

## 9. Security Considerations

### Authentication

- Basic Auth over HTTPS only
- Rate limiting on auth attempts
- Session timeout after inactivity
- Secure cookie for session management

### API Security

- All admin endpoints require authentication
- CSRF protection for state-changing operations using double-submit cookie pattern
- Input validation on all forms using Zod schemas
- SQL injection prevention via Drizzle ORM parameterized queries
- XSS prevention via EJS output encoding and Content Security Policy

#### CSRF Protection Implementation

```typescript
// Generate CSRF token on session creation
req.session.csrfToken = crypto.randomBytes(32).toString('hex');

// Include token in page render
res.render('dashboard/admin', {
  csrfToken: req.session.csrfToken,
  // ... other data
});

// Client includes token in all state-changing requests
fetch('/admin/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
  },
  credentials: 'same-origin',
  body: JSON.stringify(userData)
});

// Server validates token on state-changing operations
if (req.method !== 'GET' && req.headers['x-csrf-token'] !== req.session.csrfToken) {
  return res.status(403).json({ error: 'Invalid CSRF token' });
}
```

### Data Protection

- Never log full API keys
- Mask API keys in UI (except on generation)
- Audit log for admin actions
- Soft delete for user records

## 10. Performance Optimizations

### Frontend

- Lazy load user data (virtualized scrolling for large lists)
- Debounce search input (300ms)
- Cache tag list for autocomplete
- Minimize re-renders with proper state management

### Backend

- Indexed columns: user.name, user.email, tags.name
- Pagination at database level
- Efficient JOIN queries for user+tags
- Query result caching where appropriate

## 11. Testing Requirements

### Unit Tests

- Admin auth middleware
- User service methods
- Tag validation logic
- API key generation

### Integration Tests

- Full CRUD flow for users
- Tag assignment/removal
- Search and filter combinations
- Pagination edge cases

### E2E Tests

- Admin login flow
- Create user with tags
- Regenerate API key
- Delete user confirmation

## 12. Documentation Updates

### API Documentation

- Update Swagger with admin endpoints
- Document authentication requirements
- Provide example requests/responses

### Admin Guide

- How to access admin panel
- User management workflows
- Tag management best practices
- Security guidelines

## 13. Deployment Considerations

### Environment Variables

```env
ADMIN_API_KEY=secure-random-key-min-32-chars
SESSION_SECRET=another-secure-random-key  # For express-session
ADMIN_SESSION_TIMEOUT=900  # seconds (15 minutes)
ADMIN_MAX_LOGIN_ATTEMPTS=5
ADMIN_RATE_LIMIT_WINDOW=900  # seconds (15 minutes)
```

### Session Store Configuration

```typescript
// PostgreSQL store (using existing DB connection)
import pgSession from 'connect-pg-simple';
const PgSession = pgSession(session);

app.use(session({
  store: new PgSession({
    pool: pgPool,  // Use existing PostgreSQL connection
    tableName: 'admin_sessions',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: parseInt(process.env.ADMIN_SESSION_TIMEOUT) * 1000
  }
}));
```

### Migration Steps

1. Deploy authentication middleware
2. Deploy admin routes (no data changes)
3. Test in staging environment
4. Deploy to production
5. Document admin access for team

## 14. Acceptance Criteria

- [ ] Admin can authenticate to `/dashboard/admin` with Basic Auth (username: admin, password:
  ADMIN_API_KEY)
- [ ] Single EJS page loads with initial data from internal services
- [ ] Admin dashboard displays left sidebar with Users section
- [ ] Users list displays with server-rendered initial data
- [ ] Client-side search by name works with partial matching
- [ ] Client-side filter by tags works with multiple selections
- [ ] Create new user via existing REST API with admin header
- [ ] Regenerate API key via existing REST API with confirmation
- [ ] Add/remove tags inline using existing tag endpoints
- [ ] Delete user via existing REST API with confirmation
- [ ] All API calls use session cookie automatically (credentials: 'same-origin')
- [ ] All actions show loading states
- [ ] Success/error notifications display
- [ ] Mobile responsive design
- [ ] Theme matches existing /dashboard styling
- [ ] No new API endpoints needed (uses existing admin APIs)
- [ ] Security: no credentials stored in client-side code (uses secure session cookie)
- [ ] Admin API endpoints accept both session cookie and X-Admin-Api-Key header
- [ ] Session cookie is httpOnly and secure (in production)
