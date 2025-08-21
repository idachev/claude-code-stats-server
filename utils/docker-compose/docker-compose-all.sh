#!/bin/bash
[ "$1" = -x ] && shift && set -x
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "${DIR}"

./init-docker-secrets.sh

./init-data-volumes.sh

DOCKER_COMPOSE_FILE="${DIR}/docker-compose-all.yaml"

echo -e "\nUsing ${DOCKER_COMPOSE_FILE}"
docker compose -p claude-code-stats-all -f "${DOCKER_COMPOSE_FILE}" $*
