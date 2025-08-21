#!/bin/bash
[ "$1" = -x ] && shift && set -x
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "${DIR}"/igd-utils-lib.sh

TAG1=$1
TAG2=$2

if [[ -z "${TAG1}" ]]; then
  TAG1=${IGD_UTILS_DOCKER_TAG}
fi

PRIMARY_DOCKER_IMG=${IGD_UTILS_DOCKER_IMG}:${TAG1}

set -e

GIT_SHA=$(git rev-parse --short HEAD)
DATE_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S-%N")

echo "${GIT_SHA}-${DATE_TIME}" > version.txt

echo "Building Docker image with primary tag: ${PRIMARY_DOCKER_IMG}"
docker build -t "${PRIMARY_DOCKER_IMG}" .

if [[ -n "${TAG2}" ]]; then
  SECONDARY_DOCKER_IMG=${IGD_UTILS_DOCKER_IMG}:${TAG2}
  echo "Tagging image with secondary tag: ${SECONDARY_DOCKER_IMG}"
  docker tag "${PRIMARY_DOCKER_IMG}" "${SECONDARY_DOCKER_IMG}"
fi
