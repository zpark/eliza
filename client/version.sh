#!/bin/bash

# Define the path to the lerna.json file
LERNA_FILE="../lerna.json"

# Check if lerna.json exists
if [ ! -f "$LERNA_FILE" ]; then
  echo "Error: $LERNA_FILE does not exist."
  exit 1
fi

# Extract the version property from lerna.json
VERSION=$(jq -r '.version' "$LERNA_FILE")

# Check if version was successfully extracted
if [ -z "$VERSION" ] || [ "$VERSION" == "null" ]; then
  echo "Error: Unable to extract version from $LERNA_FILE."
  exit 1
fi

# Create or overwrite info.json with the version property
echo "{\"version\": \"$VERSION\"}" > src/lib/info.json

# Confirm success
echo "info.json created with version: $VERSION"