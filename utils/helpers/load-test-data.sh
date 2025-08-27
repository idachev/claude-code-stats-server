#!/bin/bash
[ "$1" = -x ] && shift && set -x
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Script to load test data from docs/data directory
# Usage: ./load-test-data.sh [max_users] [--dry-run]
# Parameters:
#   max_users - Optional: Maximum number of users to create (default: unlimited)
#   --dry-run - Optional: Run in dry-run mode without making actual changes
# Requires: CLAUDE_CODE_STATS_SERVER_URL and
# CLAUDE_CODE_STATS_SERVER_ADMIN_API_KEY environment variables

# Source common functions
source "${SCRIPT_DIR}/common.sh"

# Parse command line arguments
DRY_RUN=false
MAX_USERS=""

# Function to check if argument is a number
is_number() {
  [[ "$1" =~ ^[0-9]+$ ]]
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      echo -e "${YELLOW}Running in DRY RUN mode - no actual changes will be made${NC}"
      shift
      ;;
    *)
      if is_number "$1"; then
        MAX_USERS="$1"
        echo -e "${BLUE}Maximum users to create: ${MAX_USERS}${NC}"
      else
        echo -e "${RED}Invalid argument: $1${NC}"
        echo "Usage: $0 [max_users] [--dry-run]"
        exit 1
      fi
      shift
      ;;
  esac
done

# Arrays of common English first and last names for generating usernames
FIRST_NAMES=(
  "john" "jane" "michael" "sarah" "david" "emily" "robert" "lisa" "james" "mary"
  "william" "jessica" "richard" "ashley" "thomas" "amanda" "charles" "betty" "joseph" "helen"
  "christopher" "sandra" "daniel" "donna" "paul" "carol" "mark" "ruth" "donald" "sharon"
  "george" "michelle" "kenneth" "laura" "steven" "sarah" "edward" "kimberly" "brian" "deborah"
  "ronald" "jessica" "anthony" "shirley" "kevin" "cynthia" "jason" "angela" "matthew" "melissa"
  "gary" "brenda" "timothy" "emma" "jose" "olivia" "larry" "sophia" "jeffrey" "marie"
  "frank" "janet" "scott" "catherine" "eric" "frances" "stephen" "christine" "andrew" "debra"
  "raymond" "martha" "gregory" "virginia" "joshua" "maria" "jerry" "heather" "dennis" "diane"
  "walter" "julie" "patrick" "joyce" "peter" "victoria" "harold" "kelly" "douglas" "christina"
  "henry" "nancy" "carl" "evelyn" "arthur" "judith" "ryan" "megan" "roger" "cheryl"
)

LAST_NAMES=(
  "smith" "johnson" "williams" "brown" "jones" "miller" "davis" "garcia" "rodriguez" "wilson"
  "martinez" "anderson" "taylor" "thomas" "hernandez" "moore" "martin" "jackson" "thompson" "white"
  "lopez" "lee" "gonzalez" "harris" "clark" "lewis" "robinson" "walker" "perez" "hall"
  "young" "allen" "sanchez" "wright" "king" "scott" "green" "baker" "adams" "nelson"
  "hill" "ramirez" "campbell" "mitchell" "roberts" "carter" "phillips" "evans" "turner" "torres"
  "parker" "collins" "edwards" "stewart" "flores" "morris" "nguyen" "murphy" "rivera" "cook"
  "rogers" "morgan" "peterson" "cooper" "reed" "bailey" "bell" "gomez" "kelly" "howard"
  "ward" "cox" "diaz" "richardson" "wood" "watson" "brooks" "bennett" "gray" "james"
  "reyes" "cruz" "hughes" "price" "myers" "long" "foster" "sanders" "ross" "morales"
  "powell" "sullivan" "russell" "ortiz" "jenkins" "gutierrez" "perry" "butler" "barnes" "fisher"
)

# Track created users for summary
declare -a CREATED_USERS
declare -A USER_API_KEYS
declare -A USER_TAGS

# Available tags for random assignment
AVAILABLE_TAGS=("Backend" "Frontend" "Fullstack" "Max-Acc1" "Max-Acc2")

# Function to generate a random English username
generate_username() {
  local first_idx=$((RANDOM % ${#FIRST_NAMES[@]}))
  local last_idx=$((RANDOM % ${#LAST_NAMES[@]}))
  echo "${FIRST_NAMES[$first_idx]}.${LAST_NAMES[$last_idx]}"
}

# Function to generate random tags for a user
generate_random_tags() {
  local tags=()

  # Randomly decide how many tags (1 to 3)
  local num_tags=$((RANDOM % 3 + 1))

  # Create a copy of available tags
  local available=("${AVAILABLE_TAGS[@]}")
  local available_count=${#available[@]}

  # Select random tags
  for ((i=0; i<num_tags && i<available_count; i++)); do
    local index=$((RANDOM % ${#available[@]}))
    tags+=("${available[$index]}")
    # Remove selected tag from available to avoid duplicates
    available=("${available[@]:0:$index}" "${available[@]:$((index+1))}")
  done

  # Join tags with space
  echo "${tags[@]}"
}

# Function to create a user and capture the API key
create_user_and_capture_key() {
  local username="$1"
  local tags="$2"

  echo -e "${BLUE}Creating user: ${username}${NC}"
  if [[ -n "$tags" ]]; then
    echo -e "${BLUE}With tags: ${tags}${NC}"
  fi

  if [[ "$DRY_RUN" == true ]]; then
    echo -e "${YELLOW}[DRY RUN] Would create user: ${username} with tags: ${tags}${NC}"
    USER_API_KEYS["${username}"]="dry-run-api-key-${username}"
    USER_TAGS["${username}"]="${tags}"
    return 0
  fi

  # Build JSON body with username and optional tags
  local json_body="{\"username\": \"${username}\""

  if [[ -n "$tags" ]]; then
    # Convert tags to JSON array
    json_body+=", \"tags\": ["
    local first=true
    for tag in $tags; do
      if [[ "$first" == true ]]; then
        first=false
      else
        json_body+=","
      fi
      json_body+="\"${tag}\""
    done
    json_body+="]"
  fi
  json_body+="}"

  # Create the user with tags
  local response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "X-Admin-Key: ${ADMIN_API_KEY}" \
    -d "${json_body}" \
    "${SERVER_URL}/admin/users")

  local http_code=$(echo "${response}" | tail -n 1)
  local response_body=$(echo "${response}" | head -n -1)

  if [[ "${http_code}" -eq 201 ]]; then
    echo -e "${GREEN}✅ User '${username}' created successfully${NC}"

    # Extract API key from response
    local api_key=$(echo "${response_body}" | jq -r '.apiKey // empty')
    if [[ -n "${api_key}" ]]; then
      USER_API_KEYS["${username}"]="${api_key}"
      USER_TAGS["${username}"]="${tags}"
      return 0
    else
      echo -e "${RED}Error: Could not extract API key from response${NC}"
      return 1
    fi
  else
    echo -e "${RED}Failed to create user '${username}'. HTTP Status: ${http_code}${NC}"
    if [[ -n "${response_body}" ]]; then
      local error_msg=$(echo "${response_body}" | jq -r '.error // .message // empty')
      if [[ -n "${error_msg}" ]]; then
        echo "Error: ${error_msg}"
      else
        echo "${response_body}" | jq '.' 2>/dev/null || echo "${response_body}"
      fi
    fi
    return 1
  fi
}

# Function to upload data for a user
upload_data() {
  local username="$1"
  local data_file="$2"
  local api_key="$3"

  echo -e "${BLUE}Uploading data from '$(basename "${data_file}")' for user '${username}'...${NC}"

  if [[ "$DRY_RUN" == true ]]; then
    echo -e "${YELLOW}[DRY RUN] Would upload data from ${data_file} for user ${username}${NC}"
    return 0
  fi

  # Upload the data
  local response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "X-Api-Key: ${api_key}" \
    -d "@${data_file}" \
    "${SERVER_URL}/claude-code-stats?username=${username}")

  local http_code=$(echo "${response}" | tail -n 1)
  local response_body=$(echo "${response}" | head -n -1)

  # 204 No Content is a success status for this endpoint
  if [[ "${http_code}" -eq 204 ]] || [[ "${http_code}" -eq 201 ]]; then
    echo -e "${GREEN}✅ Data uploaded successfully for '${username}'${NC}"
    return 0
  else
    echo -e "${RED}Failed to upload data. HTTP Status: ${http_code}${NC}"
    if [[ -n "${response_body}" ]]; then
      echo "${response_body}" | jq '.' 2>/dev/null || echo "${response_body}"
    fi
    return 1
  fi
}

# Main script execution
main() {
  # Check environment variables
  check_required_env

  # Find test data files
  local data_dir="${SCRIPT_DIR}/../../docs/data"
  local data_files=()

  echo -e "${YELLOW}Looking for test data files in: ${data_dir}${NC}"

  # Find all ccusage JSON files
  while IFS= read -r -d '' file; do
    data_files+=("$file")
  done < <(find "${data_dir}" -name "ccusage-*.json" -type f -print0 | sort -z)

  if [[ ${#data_files[@]} -eq 0 ]]; then
    echo -e "${RED}No test data files found in ${data_dir}${NC}"
    exit 1
  fi

  echo -e "${GREEN}Found ${#data_files[@]} test data file(s)${NC}"

  # Determine how many users to create
  local users_to_create
  if [[ -n "${MAX_USERS}" ]]; then
    users_to_create=${MAX_USERS}
    echo -e "${BLUE}Will create up to ${users_to_create} users${NC}"
  else
    users_to_create=${#data_files[@]}
    echo -e "${BLUE}Will create ${users_to_create} users (one per data file)${NC}"
  fi
  echo ""

  # Process data files, reusing them if needed
  local success_count=0
  local fail_count=0
  local user_index=0
  local file_index=0

  while [[ ${user_index} -lt ${users_to_create} ]]; do
    # Get data file cyclically if we need more users than files
    local data_file="${data_files[$file_index]}"
    echo "========================================="
    echo -e "${YELLOW}User $((user_index + 1))/${users_to_create} - Processing: $(basename "${data_file}")${NC}"

    # Generate a unique username for this file
    local username=""
    local attempts=0
    local max_attempts=10

    while [[ $attempts -lt $max_attempts ]]; do
      username=$(generate_username)

      # Check if we already created this username in this session
      if [[ ! " ${CREATED_USERS[@]} " =~ " ${username} " ]]; then
        break
      fi

      ((attempts++))
    done

    if [[ $attempts -eq $max_attempts ]]; then
      echo -e "${RED}Failed to generate unique username after ${max_attempts} attempts${NC}"
      ((fail_count++))
      ((user_index++))
      # Cycle to next file for next iteration
      file_index=$(( (file_index + 1) % ${#data_files[@]} ))
      continue
    fi

    # Generate random tags for this user
    local user_tags=$(generate_random_tags)

    # Create user with tags and get API key
    if create_user_and_capture_key "${username}" "${user_tags}"; then
      CREATED_USERS+=("${username}")

      # Upload data
      if upload_data "${username}" "${data_file}" "${USER_API_KEYS[${username}]}"; then
        ((success_count++))
      else
        ((fail_count++))
      fi
    else
      ((fail_count++))
    fi

    echo ""

    # Move to next user and cycle through files
    ((user_index++))
    file_index=$(( (file_index + 1) % ${#data_files[@]} ))
  done

  # Print summary
  echo "========================================="
  echo -e "${YELLOW}SUMMARY${NC}"
  echo "========================================="
  echo -e "${GREEN}Successfully created: ${success_count} user(s)${NC}"
  if [[ ${fail_count} -gt 0 ]]; then
    echo -e "${RED}Failed: ${fail_count} user(s)${NC}"
  fi
  if [[ -n "${MAX_USERS}" ]] && [[ ${#data_files[@]} -lt ${MAX_USERS} ]]; then
    echo -e "${BLUE}Note: Reused ${#data_files[@]} data file(s) to create ${success_count} user(s)${NC}"
  fi

  if [[ ${#CREATED_USERS[@]} -gt 0 ]]; then
    echo ""
    echo -e "${BLUE}Created users with tags:${NC}"
    for user in "${CREATED_USERS[@]}"; do
      local tags="${USER_TAGS[${user}]}"
      if [[ -n "$tags" ]]; then
        echo "  - ${user}: [${tags}]"
      else
        echo "  - ${user}: [no tags]"
      fi
    done

    if [[ "$DRY_RUN" != true ]]; then
      echo ""
      echo -e "${YELLOW}User credentials have been generated. To view stats for a specific user:${NC}"
      echo "  1. Use the dashboard at: ${SERVER_URL}/dashboard?period=all"
      echo "  2. Or query the API: curl '${SERVER_URL}/claude-code-stats?user=USERNAME&period=all'"
    fi
  fi

  if [[ "$DRY_RUN" == true ]]; then
    echo ""
    echo -e "${YELLOW}This was a DRY RUN - no actual changes were made${NC}"
    echo "Run without --dry-run to actually load the test data"
  fi

  # Exit with appropriate code
  if [[ ${fail_count} -gt 0 ]]; then
    exit 1
  else
    exit 0
  fi
}

# Run main function
main
