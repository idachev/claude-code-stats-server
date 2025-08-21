#!/bin/bash
[ "$1" = -x ] && shift && set -x
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source ${DIR}/.env.docker

if [[ -z "${IGD_UTILS_REMOTE_DOCKER_USER}" ]]; then
  >&2 echo "Missing IGD_UTILS_REMOTE_DOCKER_USER check .env and .env-template"
  exit 1
fi

if [[ -z "${IGD_UTILS_DOCKER_IMG}" ]]; then
  >&2 echo "Missing IGD_UTILS_DOCKER_IMG check .env and .env-template"
  exit 1
fi
