#!/bin/bash
[ "$1" = -x ] && shift && set -x
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check required environment variables
if [[ -z "${CLAUDE_CODE_STATS_SERVER_URL}" ]]; then
  echo "Error: CLAUDE_CODE_STATS_SERVER_URL environment variable is not set"
  echo "Example: export CLAUDE_CODE_STATS_SERVER_URL=http://localhost:3000"
  exit 1
fi

if [[ -z "${CLAUDE_CODE_STATS_SERVER_API_KEY}" ]]; then
  echo "Error: CLAUDE_CODE_STATS_SERVER_API_KEY environment variable is not set"
  exit 1
fi

if [[ -z "${CLAUDE_CODE_STATS_SERVER_USERNAME}" ]]; then
  echo "Error: CLAUDE_CODE_STATS_SERVER_USERNAME environment variable is not set"
  exit 1
fi

echo "Collecting Claude Code usage statistics..."

# Create a temporary file for the stats
TMP_FILE=$(mktemp /tmp/claude-stats-XXXXXX.json)

# Cleanup function to remove temp file
cleanup() {
  rm -f "${TMP_FILE}"
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Run ccusage and save to temp file
npx ccusage --json > "${TMP_FILE}" 2>/dev/null

if [[ ! -s "${TMP_FILE}" ]]; then
  echo "Error: Failed to get usage data from ccusage or data is empty"
  exit 1
fi

# Get file size for informational purposes
FILE_SIZE=$(du -h "${TMP_FILE}" | cut -f1)
echo "Usage data collected successfully (${FILE_SIZE})"

# URL encode the username for the query parameter
USERNAME_ENCODED=$(printf '%s' "${CLAUDE_CODE_STATS_SERVER_USERNAME}" | jq -sRr @uri)

echo "Uploading stats to ${CLAUDE_CODE_STATS_SERVER_URL}/claude-code-stats?username=${USERNAME_ENCODED}..."

# Send the data to the server using the file
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: ${CLAUDE_CODE_STATS_SERVER_API_KEY}" \
  --data-binary "@${TMP_FILE}" \
  "${CLAUDE_CODE_STATS_SERVER_URL}/claude-code-stats?username=${USERNAME_ENCODED}")

# Extract status code and response body
HTTP_CODE=$(echo "${RESPONSE}" | tail -n 1)
RESPONSE_BODY=$(echo "${RESPONSE}" | head -n -1)

# Check if request was successful (204 No Content expected)
if [[ "${HTTP_CODE}" -eq 204 ]]; then
  echo "✅ Stats uploaded successfully!"
elif [[ "${HTTP_CODE}" -eq 200 ]] || [[ "${HTTP_CODE}" -eq 201 ]]; then
  echo "✅ Stats uploaded successfully!"
  if [[ -n "${RESPONSE_BODY}" ]]; then
    echo "Response: ${RESPONSE_BODY}"
  fi
else
  echo "❌ Failed to upload stats. HTTP Status: ${HTTP_CODE}"
  if [[ -n "${RESPONSE_BODY}" ]]; then
    echo "Error response: ${RESPONSE_BODY}"
  fi
  exit 1
fi
