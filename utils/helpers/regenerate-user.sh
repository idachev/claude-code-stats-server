#!/bin/bash
[ "$1" = -x ] && shift && set -x
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Script to regenerate a user's API key
# Usage: ./regenerate-user.sh <username>
# Requires: CLAUDE_CODE_STATS_SERVER_URL and CLAUDE_CODE_STATS_SERVER_ADMIN_API_KEY environment variables

# Source common functions
source "${SCRIPT_DIR}/common.sh"

# Parse arguments
USERNAME="$1"

# Validate inputs
validate_username "$USERNAME"

# Check environment variables
check_required_env

echo -e "${YELLOW}Regenerating API key for user: ${USERNAME}${NC}"
echo "Server: ${SERVER_URL}"
echo ""

# Prompt for confirmation
echo -e "${RED}⚠️  WARNING: This will invalidate the user's current API key!${NC}"
echo "The user will need to update their API key in all applications."
echo ""
read -p "Are you sure you want to regenerate the API key for '${USERNAME}'? (yes/no): " CONFIRM

if [[ "${CONFIRM}" != "yes" ]]; then
  echo -e "${BLUE}Operation cancelled${NC}"
  exit 0
fi

echo ""

# Check if user exists first
check_user_exists "${USERNAME}"

# Regenerate the API key
echo "Regenerating API key..."

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "X-Admin-Key: ${ADMIN_API_KEY}" \
  "${SERVER_URL}/admin/users/${USERNAME}/api-key/regenerate")

# Extract status code and response body
HTTP_CODE=$(echo "${RESPONSE}" | tail -n 1)
RESPONSE_BODY=$(echo "${RESPONSE}" | head -n -1)

# Check if request was successful
if [[ "${HTTP_CODE}" -eq 200 ]] || [[ "${HTTP_CODE}" -eq 201 ]]; then
  echo -e "${GREEN}✅ API key regenerated successfully!${NC}"
  echo ""
  display_api_key "${RESPONSE_BODY}" "regenerated"
else
  handle_error_response "${HTTP_CODE}" "${RESPONSE_BODY}" "regenerate"
fi
