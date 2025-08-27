#!/bin/bash

# Common functions and utilities for user management scripts

# Colors for output
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export NC='\033[0m' # No Color

# Check required environment variables
check_required_env() {
  local errors=0

  if [[ -z "${CLAUDE_CODE_STATS_SERVER_URL}" ]]; then
    echo -e "${RED}Error: CLAUDE_CODE_STATS_SERVER_URL environment variable is not set${NC}"
    echo "Example: export CLAUDE_CODE_STATS_SERVER_URL=http://localhost:3000"
    errors=$((errors + 1))
  fi

  if [[ -z "${CLAUDE_CODE_STATS_SERVER_ADMIN_API_KEY}" ]]; then
    echo -e "${RED}Error: CLAUDE_CODE_STATS_SERVER_ADMIN_API_KEY environment variable is not set${NC}"
    echo "Example: export CLAUDE_CODE_STATS_SERVER_ADMIN_API_KEY=your-admin-key"
    errors=$((errors + 1))
  fi

  if [[ $errors -gt 0 ]]; then
    exit 1
  fi

  # Export for use in scripts
  export SERVER_URL="${CLAUDE_CODE_STATS_SERVER_URL}"
  export ADMIN_API_KEY="${CLAUDE_CODE_STATS_SERVER_ADMIN_API_KEY}"
}

# Validate username format
validate_username() {
  local username="$1"

  if [[ -z "$username" ]]; then
    echo -e "${RED}Error: Username is required${NC}"
    echo "Usage: $0 <username>"
    echo "Example: $0 john-doe"
    exit 1
  fi

  if [[ ! "$username" =~ ^[a-zA-Z0-9._-]{3,128}$ ]]; then
    echo -e "${RED}Error: Invalid username format${NC}"
    echo "Username must be 3-128 characters and contain only letters, numbers, dots, underscores, and hyphens"
    exit 1
  fi
}

# Display API key and environment export commands
display_api_key() {
  local response_body="$1"
  local action="$2"  # "created" or "regenerated"

  local api_key=$(echo "${response_body}" | jq -r '.apiKey // empty')
  local username=$(echo "${response_body}" | jq -r '.username // empty')

  if [[ -n "${api_key}" ]]; then
    echo "========================================="
    if [[ "$action" == "regenerated" ]]; then
      echo -e "${GREEN}New API Key Generated:${NC}"
    else
      echo -e "${GREEN}User Details:${NC}"
    fi
    echo "Username: ${username}"
    echo ""
    echo -e "${YELLOW}API Key (store this securely, it won't be shown again):${NC}"
    echo "${api_key}"
    echo "========================================="
    echo ""

    if [[ "$action" == "regenerated" ]]; then
      echo -e "${RED}⚠️  The old API key is now invalid!${NC}"
      echo ""
    fi

    echo "To upload stats for this user, set these environment variables:"
    echo "export CLAUDE_CODE_STATS_SERVER_URL=\"${SERVER_URL}\""
    echo "export CLAUDE_CODE_STATS_SERVER_USERNAME=\"${username}\""
    echo "export CLAUDE_CODE_STATS_SERVER_API_KEY=\"${api_key}\""
  else
    echo "${response_body}" | jq '.'
  fi
}

# Handle HTTP error responses
handle_error_response() {
  local http_code="$1"
  local response_body="$2"
  local operation="$3"  # "create" or "regenerate"

  if [[ "${http_code}" -eq 400 ]]; then
    echo -e "${RED}❌ Bad Request${NC}"
    local error_msg=$(echo "${response_body}" | jq -r '.error // .message // empty')
    if [[ -n "${error_msg}" ]]; then
      echo "Error: ${error_msg}"
    else
      echo "${response_body}" | jq '.'
    fi

    # Check if user already exists (only for create operation)
    if [[ "$operation" == "create" ]] && echo "${error_msg}" | grep -qi "already exists"; then
      echo ""
      echo -e "${YELLOW}Tip: User already exists. Use regenerate-user.sh to regenerate their API key.${NC}"
    fi
    exit 1
  elif [[ "${http_code}" -eq 401 ]]; then
    echo -e "${RED}❌ Unauthorized${NC}"
    echo "Error: Invalid admin API key"
    echo "Please check CLAUDE_CODE_STATS_SERVER_ADMIN_API_KEY environment variable"
    exit 1
  elif [[ "${http_code}" -eq 404 ]]; then
    echo -e "${RED}❌ User not found${NC}"
    echo "Error: User does not exist"
    exit 1
  else
    echo -e "${RED}❌ Failed to ${operation} user. HTTP Status: ${http_code}${NC}"
    if [[ -n "${response_body}" ]]; then
      echo "${response_body}" | jq '.' 2>/dev/null || echo "${response_body}"
    fi
    exit 1
  fi
}

# Check if user exists
check_user_exists() {
  local username="$1"

  echo "Checking if user exists..."
  local response=$(curl -s -w "\n%{http_code}" \
    -X GET \
    -H "X-Admin-Key: ${ADMIN_API_KEY}" \
    "${SERVER_URL}/admin/users/${username}")

  local http_code=$(echo "${response}" | tail -n 1)
  local response_body=$(echo "${response}" | head -n -1)

  if [[ "${http_code}" -eq 404 ]]; then
    echo -e "${RED}❌ User '${username}' not found${NC}"
    exit 1
  elif [[ "${http_code}" -ne 200 ]]; then
    echo -e "${RED}❌ Failed to check user. HTTP Status: ${http_code}${NC}"
    if [[ -n "${response_body}" ]]; then
      echo "${response_body}" | jq '.' 2>/dev/null || echo "${response_body}"
    fi
    exit 1
  fi

  echo "User found."
}
