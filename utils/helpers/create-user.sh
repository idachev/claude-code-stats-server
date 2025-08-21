#!/bin/bash
[ "$1" = -x ] && shift && set -x
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Script to create a new user with API key
# Usage: ./create-user.sh <username>
# Requires: CLAUDE_CODE_STATS_SERVER_URL and CLAUDE_CODE_STATS_SERVER_ADMIN_API_KEY environment variables

# Source common functions
source "${SCRIPT_DIR}/common.sh"

# Parse arguments
USERNAME="$1"

# Validate inputs
validate_username "$USERNAME"

# Check environment variables
check_required_env

echo -e "${YELLOW}Creating user: ${USERNAME}${NC}"
echo "Server: ${SERVER_URL}"

# Create the user
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: ${ADMIN_API_KEY}" \
  -d "{\"username\": \"${USERNAME}\"}" \
  "${SERVER_URL}/admin/users")

# Extract status code and response body
HTTP_CODE=$(echo "${RESPONSE}" | tail -n 1)
RESPONSE_BODY=$(echo "${RESPONSE}" | head -n -1)

# Check if request was successful
if [[ "${HTTP_CODE}" -eq 201 ]]; then
  echo -e "${GREEN}✅ User created successfully!${NC}"
  echo ""
  display_api_key "${RESPONSE_BODY}" "created"
else
  handle_error_response "${HTTP_CODE}" "${RESPONSE_BODY}" "create"
fi
