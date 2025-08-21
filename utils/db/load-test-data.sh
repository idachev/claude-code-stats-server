#!/bin/bash
[ "$1" = -x ] && shift && set -x
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load test data into Claude Code Stats Server
# Usage: ./load-test-data.sh [data_directory]
# Default data directory: ../../docs/data

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Data directory (can be overridden by command line argument)
DATA_DIR="${1:-$PROJECT_ROOT/docs/data}"

echo -e "${YELLOW}Claude Code Stats - Load Test Data${NC}"
echo "==================================="
echo -e "${BLUE}Data directory: $DATA_DIR${NC}"
echo ""

# Check if data directory exists
if [ ! -d "$DATA_DIR" ]; then
    echo -e "${RED}Error: Data directory not found: $DATA_DIR${NC}"
    echo "Usage: $0 [data_directory]"
    exit 1
fi

# Check if there are any JSON files in the directory
if ! ls "$DATA_DIR"/*.json >/dev/null 2>&1; then
    echo -e "${RED}Error: No JSON files found in $DATA_DIR${NC}"
    exit 1
fi

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${GREEN}Loading environment variables from .env${NC}"
    export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | xargs)
else
    echo -e "${RED}Error: .env file not found!${NC}"
    exit 1
fi

# Check required environment variables
if [ -z "$ADMIN_API_KEY" ]; then
    echo -e "${RED}Error: ADMIN_API_KEY is not set in .env${NC}"
    exit 1
fi

# Server configuration
SERVER_URL="${SERVER_URL:-http://localhost:3000}"
echo -e "Server URL: ${BLUE}$SERVER_URL${NC}"

echo -e "${YELLOW}Running database cleanup...${NC}"
"$SCRIPT_DIR/cleanup-db.sh"
if [ $? -ne 0 ]; then
    echo -e "${RED}Database cleanup failed or was cancelled${NC}"
    exit 1
fi
echo ""

# Check server status
echo -e "\n${YELLOW}Checking server status...${NC}"
echo "------------------------"

if ! curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/health" | grep -q "200"; then
  echo -e "${YELLOW} Server is not running, please start it first.${NC}"
  exit 1
else
    echo -e "${GREEN}✓ Server is already running${NC}"
fi

# Process data files
echo -e "\n${YELLOW}Loading Data Files${NC}"
echo "------------------------"

# Arrays to track results
declare -A USER_API_KEYS
declare -A USER_STATS
TOTAL_FILES=0
SUCCESS_COUNT=0
FAILED_COUNT=0

# Process each JSON file
for DATA_FILE in "$DATA_DIR"/*.json; do
    if [ ! -f "$DATA_FILE" ]; then
        continue
    fi

    TOTAL_FILES=$((TOTAL_FILES + 1))
    FILENAME=$(basename "$DATA_FILE")

    # Extract username from filename
    # Support different naming patterns:
    # - ccusage-example-data-0.json -> example-user-0
    # - username.json -> username
    # - any-name.json -> any-name
    if [[ "$FILENAME" =~ ccusage-example-data-([0-9]+)\.json ]]; then
        USERNAME="example-user-${BASH_REMATCH[1]}"
    else
        # Remove .json extension to get username
        USERNAME="${FILENAME%.json}"
        # Replace spaces and special chars with hyphens
        USERNAME=$(echo "$USERNAME" | tr ' ' '-' | tr -cd '[:alnum:]-_.')
    fi

    echo -e "\n${BLUE}[$TOTAL_FILES] Processing: $FILENAME${NC}"
    echo "    Username: $USERNAME"

    # Create API key for the user
    echo -n "    Creating API key..."

    API_KEY_RESPONSE=$(curl -s -X POST "$SERVER_URL/admin/generate-api-key" \
        -H "Content-Type: application/json" \
        -H "x-admin-key: $ADMIN_API_KEY" \
        -d "{\"username\": \"$USERNAME\"}" 2>/dev/null)

    if echo "$API_KEY_RESPONSE" | grep -q "apiKey"; then
        USER_API_KEY=$(echo "$API_KEY_RESPONSE" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)
        USER_API_KEYS["$USERNAME"]="$USER_API_KEY"
        echo -e " ${GREEN}✓${NC}"
    else
        echo -e " ${RED}✗${NC}"
        echo -e "    ${RED}Error: $API_KEY_RESPONSE${NC}"
        FAILED_COUNT=$((FAILED_COUNT + 1))
        continue
    fi

    # Upload stats data
    echo -n "    Uploading stats..."

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SERVER_URL/claude-code-stats?username=$USERNAME" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $USER_API_KEY" \
        -d @"$DATA_FILE" 2>/dev/null)

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
        echo -e " ${GREEN}✓${NC}"

        # Count statistics from the file
        DAYS_COUNT=$(grep -c '"date"' "$DATA_FILE" 2>/dev/null || echo "0")
        TOTAL_TOKENS=$(grep '"totalTokens"' "$DATA_FILE" | grep -o '[0-9]*' | awk '{sum+=$1} END {print sum}' 2>/dev/null || echo "0")

        USER_STATS["$USERNAME"]="$DAYS_COUNT days, $(echo "scale=2; $TOTAL_TOKENS/1000000" | bc 2>/dev/null || echo "0")M tokens"
        echo -e "    ${GREEN}Loaded: ${USER_STATS[$USERNAME]}${NC}"

        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo -e " ${RED}✗ (HTTP $HTTP_CODE)${NC}"
        FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
done

# Summary
echo -e "\n${YELLOW}Summary${NC}"
echo "======================================="
echo -e "Total files processed: ${BLUE}$TOTAL_FILES${NC}"
echo -e "Successful uploads: ${GREEN}$SUCCESS_COUNT${NC}"
if [ $FAILED_COUNT -gt 0 ]; then
    echo -e "Failed uploads: ${RED}$FAILED_COUNT${NC}"
fi

# Display created users
if [ ${#USER_API_KEYS[@]} -gt 0 ]; then
    echo -e "\n${YELLOW}Created Users:${NC}"
    echo "----------------------------------------"
    for USERNAME in "${!USER_API_KEYS[@]}"; do
        API_KEY="${USER_API_KEYS[$USERNAME]}"
        STATS="${USER_STATS[$USERNAME]:-No data}"
        echo -e "  ${BLUE}$USERNAME${NC}"
        echo "    API Key: ${API_KEY:0:20}..."
        echo "    Stats: $STATS"
    done
fi

echo -e "\n${GREEN}✓ Data loading complete!${NC}"
echo -e "Dashboard: ${BLUE}$SERVER_URL/dashboard${NC}"
