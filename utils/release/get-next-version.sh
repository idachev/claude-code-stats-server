#!/bin/bash
set -e

LATEST_TAG=$(git tag --list --sort=-version:refname | head -1)
if [ -z "$LATEST_TAG" ]; then
  LATEST_TAG="v0.1.0"
fi

echo "Latest tag: $LATEST_TAG"

VERSION=${LATEST_TAG#v}
IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"
PATCH=$((PATCH + 1))

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
NEW_TAG="v$NEW_VERSION"

echo "New version: $NEW_VERSION"
echo "New tag: $NEW_TAG"

if [ -n "$GITHUB_OUTPUT" ]; then
  echo "version=$NEW_VERSION" >> $GITHUB_OUTPUT
  echo "tag=$NEW_TAG" >> $GITHUB_OUTPUT
fi

echo "NEW_VERSION=$NEW_VERSION"
echo "NEW_TAG=$NEW_TAG"