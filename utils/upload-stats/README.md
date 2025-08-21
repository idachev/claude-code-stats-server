# Claude Code Stats Upload Script

This script automates the collection and upload of Claude Code usage statistics to the stats server.

## Prerequisites

- `npx` command available (comes with Node.js/npm)
- `ccusage` CLI tool accessible via npx
- `jq` command for JSON processing (for URL encoding)
- `curl` command for HTTP requests

## Required Environment Variables

Set these environment variables before running the script:

```bash
export CLAUDE_CODE_STATS_SERVER_URL="http://your-server:3000"
export CLAUDE_CODE_STATS_SERVER_USERNAME="your-username"
export CLAUDE_CODE_STATS_SERVER_API_KEY="your-api-key"
```

## Usage

1. Make the script executable:
```bash
chmod +x utils/upload-stats.sh
```

2. Run the script:
```bash
./utils/upload-stats.sh
```

## What it does

1. Collects usage statistics by running `npx ccusage --json`
2. URL-encodes the username for the query parameter
3. Sends the data to the server endpoint `/claude-code-stats?username=<username>`
4. Includes the API key in the `X-API-KEY` header for authentication
5. Reports success (204 No Content) or failure with error details

## Example Output

Success:
```
Collecting Claude Code usage statistics...
Usage data collected successfully
Uploading stats to http://localhost:3000/claude-code-stats?username=john-doe...
✅ Stats uploaded successfully!
```

Error:
```
Collecting Claude Code usage statistics...
Usage data collected successfully
Uploading stats to http://localhost:3000/claude-code-stats?username=john-doe...
❌ Failed to upload stats. HTTP Status: 401
Error response: {"error":"Unauthorized"}
```

## Automation with Cron

To automatically upload stats daily, add to your crontab:

```bash
# Upload Claude Code stats daily at 2 AM
0 2 * * * CLAUDE_CODE_STATS_SERVER_URL="http://your-server:3000" CLAUDE_CODE_STATS_SERVER_USERNAME="your-username" CLAUDE_CODE_STATS_SERVER_API_KEY="your-api-key" /path/to/upload-stats.sh >> /var/log/claude-stats-upload.log 2>&1
```

## Troubleshooting

### Missing jq command
If you get an error about `jq` not being found, install it:
- Ubuntu/Debian: `sudo apt-get install jq`
- macOS: `brew install jq`
- Other: See https://stedolan.github.io/jq/download/

### ccusage not found
Make sure you have the Claude Code CLI installed and `npx ccusage` works from your terminal.

### 401 Unauthorized
- Verify your API key is correct
- Check that the username matches the one associated with the API key
- Ensure the user exists in the database

### Connection refused
- Check that the server is running
- Verify the server URL is correct
- Check firewall settings if accessing remotely