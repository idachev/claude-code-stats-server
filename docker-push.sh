#!/bin/bash
[ "$1" = -x ] && shift && set -x
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "${DIR}"/igd-utils-lib.sh

TAG1=$1
TAG2=$2

if [[ -z "${TAG1}" ]]; then
  TAG1=${IGD_UTILS_DOCKER_TAG}
fi

LOCAL_PRIMARY_IMG=${IGD_UTILS_DOCKER_IMG}:${TAG1}
REMOTE_PRIMARY_IMG=${IGD_UTILS_REMOTE_DOCKER_USER}/${IGD_UTILS_DOCKER_IMG}:${TAG1}

set -e

echo "Tagging and pushing primary image: ${REMOTE_PRIMARY_IMG}"
docker tag "${LOCAL_PRIMARY_IMG}" "${REMOTE_PRIMARY_IMG}"
docker push "${REMOTE_PRIMARY_IMG}"

if [[ -n "${TAG2}" ]]; then
  LOCAL_SECONDARY_IMG=${IGD_UTILS_DOCKER_IMG}:${TAG2}
  REMOTE_SECONDARY_IMG=${IGD_UTILS_REMOTE_DOCKER_USER}/${IGD_UTILS_DOCKER_IMG}:${TAG2}
  
  echo "Tagging and pushing secondary image: ${REMOTE_SECONDARY_IMG}"
  docker tag "${LOCAL_SECONDARY_IMG}" "${REMOTE_SECONDARY_IMG}"
  docker push "${REMOTE_SECONDARY_IMG}"
fi
