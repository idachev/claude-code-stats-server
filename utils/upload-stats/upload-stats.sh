#!/bin/bash
[ "$1" = -x ] && shift && set -x
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Script to upload Claude Code usage statistics
# Usage: ./upload-stats.sh [stats-file.json]
# If no file is provided, will collect stats using ccusage

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

# Check if a file argument was provided
if [[ -n "$1" ]]; then
  # Use provided file
  STATS_FILE="$1"

  if [[ ! -f "${STATS_FILE}" ]]; then
    echo "Error: File '${STATS_FILE}' does not exist"
    exit 1
  fi

  if [[ ! -s "${STATS_FILE}" ]]; then
    echo "Error: File '${STATS_FILE}' is empty"
    exit 1
  fi

  # Validate it's JSON
  if ! jq empty "${STATS_FILE}" 2>/dev/null; then
    echo "Error: File '${STATS_FILE}' is not valid JSON"
    exit 1
  fi

  echo "Using provided stats file: ${STATS_FILE}"
  TMP_FILE="${STATS_FILE}"
  CLEANUP_TMP=false
else
  # No file provided, collect stats using ccusage
  echo "Collecting Claude Code usage statistics..."

  # Create a temporary file for the stats
  TMP_FILE=$(mktemp /tmp/claude-stats-XXXXXX.json)
  CLEANUP_TMP=true

  # Run ccusage and save to temp file
  npx ccusage --json > "${TMP_FILE}" 2>/dev/null

  if [[ ! -s "${TMP_FILE}" ]]; then
    echo "Error: Failed to get usage data from ccusage or data is empty"
    rm -f "${TMP_FILE}"
    exit 1
  fi
fi

# Cleanup function to remove temp file (only if we created it)
cleanup() {
  if [[ "${CLEANUP_TMP}" == "true" ]]; then
    rm -f "${TMP_FILE}"
  fi
}

# Set trap to cleanup on exit
trap cleanup EXIT

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
