#!/bin/bash

URL="https://github.com/Loyalsoldier/geoip/releases/latest/download/Country.mmdb"
DEST_DIR="./public"
DEST_FILENAME="Country.mmdb"
DESTINATION="$DEST_DIR/$DEST_FILENAME"

if [ ! -d "$DEST_DIR" ]; then
    echo "Creating directory: $DEST_DIR"
    mkdir -p "$DEST_DIR"
fi

echo "Downloading file from $URL..."

if curl -L -o "$DESTINATION" "$URL"; then
    echo "Download completed successfully."
else
    echo "Download failed. Please check your internet connection or the URL."
    exit 1
fi

if [ -f "$DESTINATION" ]; then
    echo "File successfully saved as $DESTINATION"
else
    echo "Error: Downloaded file not found at $DESTINATION"
    exit 1
fi
