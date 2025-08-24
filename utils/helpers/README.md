# User Management Helper Scripts

These scripts provide a convenient way to manage users and API keys for the Claude Code Stats Server.

## Prerequisites

- `bash` shell
- `curl` command
- `jq` command for JSON parsing
- Environment variables set (see Configuration below)

## Required Environment Variables

Before using these scripts, you must set:

```bash
export CLAUDE_CODE_STATS_SERVER_URL="http://localhost:3000"
export CLAUDE_CODE_STATS_SERVER_ADMIN_API_KEY="your-admin-api-key"
```

You can get the admin API key from your `.env` file (look for `ADMIN_API_KEY`).

## Available Scripts

### create-user.sh

Creates a new user with an automatically generated API key.

**Usage:**
```bash
./create-user.sh <username>
```

**Example:**
```bash
# Set environment variables first
export CLAUDE_CODE_STATS_SERVER_URL="http://localhost:3000"
export CLAUDE_CODE_STATS_SERVER_ADMIN_API_KEY="ccs_admin_change_this_in_production"

# Create user
./create-user.sh john-doe
```

**Features:**
- Validates username format (3-50 chars, alphanumeric with dots, underscores, hyphens)
- Displays the generated API key (only shown once!)
- Provides environment variable export commands for easy setup
- Detects if user already exists and suggests using regenerate script

### regenerate-user.sh

Regenerates a user's API key, invalidating their current key.

**Usage:**
```bash
./regenerate-user.sh <username>
```

**Example:**
```bash
# Set environment variables first
export CLAUDE_CODE_STATS_SERVER_URL="http://localhost:3000"
export CLAUDE_CODE_STATS_SERVER_ADMIN_API_KEY="ccs_admin_change_this_in_production"

# Regenerate API key for user
./regenerate-user.sh john-doe
```

**Features:**
- Checks if user exists before attempting to regenerate
- Requires confirmation before regenerating (safety measure)
- Generates and displays new API key
- Warns about old key invalidation
- Provides environment variable export commands for the new key

### set-user-tags.sh

Manages tags for a user (add, remove, replace, or clear tags).

**Usage:**
```bash
./set-user-tags.sh <username> <action> [tags...]
```

**Actions:**
- `set` - Replace all tags with the provided tags
- `add` - Add new tags to existing tags
- `remove` - Remove specific tags
- `clear` - Remove all tags
- `get` - Show current tags

**Examples:**
```bash
# Set environment variables first
export CLAUDE_CODE_STATS_SERVER_URL="http://localhost:3000"
export CLAUDE_CODE_STATS_SERVER_ADMIN_API_KEY="ccs_admin_change_this_in_production"

# Replace all tags
./set-user-tags.sh john-doe set frontend react typescript

# Add tags to existing ones
./set-user-tags.sh john-doe add nodejs express

# Remove specific tags
./set-user-tags.sh john-doe remove frontend

# Clear all tags
./set-user-tags.sh john-doe clear

# Get current tags
./set-user-tags.sh john-doe get
```

**Features:**
- Supports multiple tag operations (set, add, remove, clear, get)
- Validates tag names according to server rules
- Shows current tags after modifications
- Handles case-insensitive duplicate detection
- URL-encodes tags when removing for proper handling of special characters

### common.sh

Shared utility functions used by both scripts. This file contains:
- Environment variable validation
- Username format validation
- HTTP error handling
- API key display formatting
- User existence checking

This file is automatically sourced by the other scripts and doesn't need to be run directly.

## Error Handling

The scripts provide clear error messages for common issues:
- Missing or invalid admin API key
- User already exists (when creating)
- User not found (when regenerating)
- Invalid username format
- Network/server errors

## Security Notes

1. **API Keys are shown only once** - When creating or regenerating API keys, they are displayed only once. Store them securely!

2. **Admin Key Required** - Both scripts require a valid admin API key to function. This prevents unauthorized user management.

3. **Confirmation for Regeneration** - The regenerate script requires explicit confirmation to prevent accidental key invalidation.

## Making Scripts Executable

If the scripts are not executable, run:
```bash
chmod +x create-user.sh regenerate-user.sh set-user-tags.sh
```

## Troubleshooting

### "CLAUDE_CODE_STATS_SERVER_URL environment variable is not set"
Set the server URL:
```bash
export CLAUDE_CODE_STATS_SERVER_URL="http://localhost:3000"
```

### "CLAUDE_CODE_STATS_SERVER_ADMIN_API_KEY environment variable is not set"
Set the admin API key from your `.env` file:
```bash
export CLAUDE_CODE_STATS_SERVER_ADMIN_API_KEY="your-admin-key"
```

### "jq: command not found"
Install jq:
- Ubuntu/Debian: `sudo apt-get install jq`
- macOS: `brew install jq`
- Other: See https://stedolan.github.io/jq/download/

### "401 Unauthorized"
- Verify your admin API key is correct
- Check that the server is running and accessible

### User already exists
- Use `regenerate-user.sh` to regenerate their API key instead

### Connection refused
- Check that the server is running
- Verify the server URL is correct
- Check firewall settings if accessing remotely