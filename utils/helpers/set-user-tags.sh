#!/bin/bash
[ "$1" = -x ] && shift && set -x
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Script to manage tags for a user
# Usage: ./set-user-tags.sh <username> <action> [tags...]
# Actions: set (replace all), add (append), remove (delete specific), clear (remove all)
# Requires: CLAUDE_CODE_STATS_SERVER_URL and CLAUDE_CODE_STATS_SERVER_ADMIN_API_KEY environment variables

# Source common functions
source "${SCRIPT_DIR}/common.sh"

# Parse arguments
USERNAME="$1"
ACTION="$2"
shift 2
TAGS=("$@")

# Function to show usage
show_usage() {
  echo "Usage: $0 <username> <action> [tags...]"
  echo ""
  echo "Actions:"
  echo "  set     - Replace all tags with the provided tags"
  echo "  add     - Add new tags to existing tags"
  echo "  remove  - Remove specific tags"
  echo "  clear   - Remove all tags"
  echo "  get     - Show current tags"
  echo ""
  echo "Examples:"
  echo "  $0 john-doe set frontend react typescript"
  echo "  $0 john-doe add nodejs express"
  echo "  $0 john-doe remove frontend"
  echo "  $0 john-doe clear"
  echo "  $0 john-doe get"
  exit 1
}

# Validate inputs
if [[ -z "$USERNAME" ]]; then
  echo -e "${RED}Error: Username is required${NC}"
  show_usage
fi

validate_username "$USERNAME"

if [[ -z "$ACTION" ]]; then
  echo -e "${RED}Error: Action is required${NC}"
  show_usage
fi

# Validate action
if [[ ! "$ACTION" =~ ^(set|add|remove|clear|get)$ ]]; then
  echo -e "${RED}Error: Invalid action '${ACTION}'${NC}"
  show_usage
fi

# Validate tags are provided for actions that need them
if [[ "$ACTION" =~ ^(set|add|remove)$ ]] && [[ ${#TAGS[@]} -eq 0 ]]; then
  echo -e "${RED}Error: At least one tag is required for action '${ACTION}'${NC}"
  show_usage
fi

# Check environment variables
check_required_env

# Function to get current tags
get_current_tags() {
  local response=$(curl -s -w "\n%{http_code}" \
    -X GET \
    -H "X-Admin-Key: ${ADMIN_API_KEY}" \
    "${SERVER_URL}/admin/users/${USERNAME}/tags")

  local http_code=$(echo "${response}" | tail -n 1)
  local response_body=$(echo "${response}" | head -n -1)

  if [[ "${http_code}" -eq 200 ]]; then
    echo "${response_body}"
  elif [[ "${http_code}" -eq 404 ]]; then
    echo -e "${RED}❌ User '${USERNAME}' not found${NC}"
    exit 1
  else
    echo -e "${RED}❌ Failed to get tags. HTTP Status: ${http_code}${NC}"
    if [[ -n "${response_body}" ]]; then
      echo "${response_body}" | jq '.' 2>/dev/null || echo "${response_body}"
    fi
    exit 1
  fi
}

# Function to format tags as JSON array
format_tags_json() {
  local tags=("$@")
  local json_array="["
  local first=true

  for tag in "${tags[@]}"; do
    if [[ "$first" == true ]]; then
      first=false
    else
      json_array+=","
    fi
    # Escape quotes in tag names
    local escaped_tag=$(echo "$tag" | sed 's/"/\\"/g')
    json_array+="\"${escaped_tag}\""
  done

  json_array+="]"
  echo "$json_array"
}

# Handle GET action
if [[ "$ACTION" == "get" ]]; then
  echo -e "${YELLOW}Getting tags for user: ${USERNAME}${NC}"
  echo "Server: ${SERVER_URL}"

  CURRENT_TAGS=$(get_current_tags)

  echo ""
  echo -e "${GREEN}Current tags:${NC}"
  if [[ "$CURRENT_TAGS" == "[]" ]]; then
    echo "  (no tags)"
  else
    echo "$CURRENT_TAGS" | jq -r '.[]' | while read -r tag; do
      echo "  • $tag"
    done
  fi
  exit 0
fi

# For other actions, first check if user exists
check_user_exists "$USERNAME"

# Handle CLEAR action
if [[ "$ACTION" == "clear" ]]; then
  echo -e "${YELLOW}Clearing all tags for user: ${USERNAME}${NC}"
  echo "Server: ${SERVER_URL}"

  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X PUT \
    -H "Content-Type: application/json" \
    -H "X-Admin-Key: ${ADMIN_API_KEY}" \
    -d '{"tags": []}' \
    "${SERVER_URL}/admin/users/${USERNAME}/tags")

  HTTP_CODE=$(echo "${RESPONSE}" | tail -n 1)

  if [[ "${HTTP_CODE}" -eq 204 ]]; then
    echo -e "${GREEN}✅ Tags cleared successfully!${NC}"
  else
    RESPONSE_BODY=$(echo "${RESPONSE}" | head -n -1)
    echo -e "${RED}❌ Failed to clear tags. HTTP Status: ${HTTP_CODE}${NC}"
    if [[ -n "${RESPONSE_BODY}" ]]; then
      echo "${RESPONSE_BODY}" | jq '.' 2>/dev/null || echo "${RESPONSE_BODY}"
    fi
    exit 1
  fi
  exit 0
fi

# Handle SET action
if [[ "$ACTION" == "set" ]]; then
  echo -e "${YELLOW}Setting tags for user: ${USERNAME}${NC}"
  echo "Server: ${SERVER_URL}"
  echo "Tags to set: ${TAGS[*]}"

  TAGS_JSON=$(format_tags_json "${TAGS[@]}")

  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X PUT \
    -H "Content-Type: application/json" \
    -H "X-Admin-Key: ${ADMIN_API_KEY}" \
    -d "{\"tags\": ${TAGS_JSON}}" \
    "${SERVER_URL}/admin/users/${USERNAME}/tags")

  HTTP_CODE=$(echo "${RESPONSE}" | tail -n 1)

  if [[ "${HTTP_CODE}" -eq 204 ]]; then
    echo -e "${GREEN}✅ Tags set successfully!${NC}"
    echo ""
    echo "New tags:"
    for tag in "${TAGS[@]}"; do
      echo "  • $tag"
    done
  else
    RESPONSE_BODY=$(echo "${RESPONSE}" | head -n -1)
    echo -e "${RED}❌ Failed to set tags. HTTP Status: ${HTTP_CODE}${NC}"
    if [[ -n "${RESPONSE_BODY}" ]]; then
      echo "${RESPONSE_BODY}" | jq '.' 2>/dev/null || echo "${RESPONSE_BODY}"
    fi
    exit 1
  fi
  exit 0
fi

# Handle ADD action
if [[ "$ACTION" == "add" ]]; then
  echo -e "${YELLOW}Adding tags to user: ${USERNAME}${NC}"
  echo "Server: ${SERVER_URL}"
  echo "Tags to add: ${TAGS[*]}"

  TAGS_JSON=$(format_tags_json "${TAGS[@]}")

  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "X-Admin-Key: ${ADMIN_API_KEY}" \
    -d "{\"tags\": ${TAGS_JSON}}" \
    "${SERVER_URL}/admin/users/${USERNAME}/tags")

  HTTP_CODE=$(echo "${RESPONSE}" | tail -n 1)

  if [[ "${HTTP_CODE}" -eq 204 ]]; then
    echo -e "${GREEN}✅ Tags added successfully!${NC}"
    echo ""
    # Get and display current tags
    echo "Current tags:"
    CURRENT_TAGS=$(get_current_tags)
    echo "$CURRENT_TAGS" | jq -r '.[]' | while read -r tag; do
      echo "  • $tag"
    done
  else
    RESPONSE_BODY=$(echo "${RESPONSE}" | head -n -1)
    echo -e "${RED}❌ Failed to add tags. HTTP Status: ${HTTP_CODE}${NC}"
    if [[ -n "${RESPONSE_BODY}" ]]; then
      echo "${RESPONSE_BODY}" | jq '.' 2>/dev/null || echo "${RESPONSE_BODY}"
    fi
    exit 1
  fi
  exit 0
fi

# Handle REMOVE action
if [[ "$ACTION" == "remove" ]]; then
  echo -e "${YELLOW}Removing tags from user: ${USERNAME}${NC}"
  echo "Server: ${SERVER_URL}"
  echo "Tags to remove: ${TAGS[*]}"

  # Remove tags one by one
  FAILED=0
  for tag in "${TAGS[@]}"; do
    # URL encode the tag
    ENCODED_TAG=$(echo -n "$tag" | jq -sRr @uri)

    RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X DELETE \
      -H "X-Admin-Key: ${ADMIN_API_KEY}" \
      "${SERVER_URL}/admin/users/${USERNAME}/tags/${ENCODED_TAG}")

    HTTP_CODE=$(echo "${RESPONSE}" | tail -n 1)

    if [[ "${HTTP_CODE}" -eq 204 ]]; then
      echo -e "  ${GREEN}✓${NC} Removed: $tag"
    else
      echo -e "  ${RED}✗${NC} Failed to remove: $tag (HTTP ${HTTP_CODE})"
      FAILED=$((FAILED + 1))
    fi
  done

  if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}✅ All tags removed successfully!${NC}"
    echo ""
    # Get and display current tags
    echo "Remaining tags:"
    CURRENT_TAGS=$(get_current_tags)
    if [[ "$CURRENT_TAGS" == "[]" ]]; then
      echo "  (no tags)"
    else
      echo "$CURRENT_TAGS" | jq -r '.[]' | while read -r tag; do
        echo "  • $tag"
      done
    fi
  else
    echo -e "${YELLOW}⚠️  Some tags could not be removed${NC}"
    exit 1
  fi
  exit 0
fi
