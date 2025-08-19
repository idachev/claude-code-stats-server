#!/bin/bash
[ "$1" = -x ] && shift && set -x
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "${DIR}/../.." || exit 1

DB_CONTAINER_NAME="claude-code-stats-db"

if docker inspect -f '{{.State.Running}}' "${DB_CONTAINER_NAME}" | grep true >/dev/null 2>&1; then
  echo "Database container ${DB_CONTAINER_NAME} is running"
else
  echo "Starting database container ${DB_CONTAINER_NAME}"

  ./utils/docker-compose/docker-compose.sh up -d
fi
