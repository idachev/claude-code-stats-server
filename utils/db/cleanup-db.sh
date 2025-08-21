#!/bin/bash
[ "$1" = -x ] && shift && set -x
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Database cleanup script for Claude Code Stats Server
# This script truncates all tables in the database

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

echo -e "${YELLOW}Claude Code Stats Database Cleanup${NC}"
echo "==================================="

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo -e "${GREEN}Loading environment variables from .env${NC}"
    export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | xargs)
else
    echo -e "${RED}Error: .env file not found!${NC}"
    exit 1
fi

# Use individual database environment variables
DB_HOST="${DB_HOST}"
DB_PORT="${DB_PORT}"
DB_NAME="${DB_NAME}"
DB_USER="${DB_USER}"
DB_PASSWORD="${DB_PASSWORD}"

# Check if required variables are set
if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
    echo -e "${RED}Error: Missing required database environment variables${NC}"
    echo "Required variables: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD"
    exit 1
fi

# Load password from docker-secrets if available (overrides env variable)
DB_PASSWORD_FILE="$PROJECT_ROOT/utils/docker-compose/docker-secrets/db-password"
if [ -f "$DB_PASSWORD_FILE" ]; then
    DB_PASSWORD=$(cat "$DB_PASSWORD_FILE" | tr -d '\n')
    echo -e "${GREEN}Loaded database password from docker-secrets${NC}"
fi

echo -e "\n${YELLOW}Database Connection:${NC}"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"

# Confirm cleanup
echo -e "\n${RED}WARNING: This will DELETE ALL DATA from the database!${NC}"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}Cleanup cancelled.${NC}"
    exit 1
fi

# Execute cleanup SQL script
echo -e "\n${YELLOW}Executing cleanup...${NC}"

CLEANUP_SQL="$SCRIPT_DIR/cleanup.sql"
if [ ! -f "$CLEANUP_SQL" ]; then
    echo -e "${RED}Error: cleanup.sql not found at $CLEANUP_SQL${NC}"
    exit 1
fi

# Run the cleanup script and capture output and exit status
echo -e "${YELLOW}Running SQL cleanup script...${NC}"

# Use a temporary file to capture both output and exit code properly
TEMP_OUTPUT=$(mktemp)
PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$CLEANUP_SQL" \
    --no-align \
    --tuples-only > "$TEMP_OUTPUT" 2>&1

PSQL_EXIT_CODE=$?

# Read the output
OUTPUT=$(cat "$TEMP_OUTPUT")
rm -f "$TEMP_OUTPUT"

# Check if psql command failed
if [ $PSQL_EXIT_CODE -ne 0 ]; then
    echo -e "\n${RED}✗ Database cleanup failed!${NC}"
    echo -e "${RED}psql error (exit code: $PSQL_EXIT_CODE):${NC}"

    # Display all output including errors
    if [ -n "$OUTPUT" ]; then
        echo "$OUTPUT" | while IFS= read -r line; do
            echo -e "  ${RED}$line${NC}"
        done
    else
        echo -e "  ${RED}No error output captured${NC}"
    fi

    echo ""
    echo -e "${YELLOW}Troubleshooting tips:${NC}"
    echo "  - Check DATABASE_URL in .env file"
    echo "  - Verify PostgreSQL is running: docker ps"
    echo "  - Check password in: $DB_PASSWORD_FILE"
    echo "  - Current connection attempt:"
    echo "    Host: $DB_HOST"
    echo "    Port: $DB_PORT"
    echo "    User: $DB_USER"
    echo "    Database: $DB_NAME"
    echo "  - Test connection manually:"
    echo "    PGPASSWORD='$DB_PASSWORD' psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c '\\l'"
    exit 1
fi

# Display the output (table counts) if successful
if [ -n "$OUTPUT" ]; then
    echo "$OUTPUT" | while IFS= read -r line; do
        if [[ $line == *"count:"* ]]; then
            echo "  $line"
        fi
    done
else
    echo "  Tables truncated successfully (no output)"
fi

echo -e "\n${GREEN}✓ Database cleanup complete!${NC}"
