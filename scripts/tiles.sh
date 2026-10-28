#!/bin/sh
set -e
cd "$(dirname "$0")/.."

BUILD=20261028
IMAGE=protomaps/go-pmtiles:v1.31.2@sha256:06574f01f55a78f78f887bc7ebf729a5c093c0d6e17d9876300cfcb0758b59d3

if [ -z "$TILES_BBOX" ] && [ -f .env ]; then
    TILES_BBOX=$(sed -n 's/^TILES_BBOX=//p' .env | tail -n 1 | tr -d "\"'\r")
fi
BBOX=${TILES_BBOX:-36.60,-1.50,37.15,-1.10}

echo "Extracting Protomaps build $BUILD, bbox $BBOX, into var/tiles/nairobi.pmtiles"
docker run --rm -v "$(pwd)/var/tiles:/data" "$IMAGE" \
    extract "https://build.protomaps.com/$BUILD.pmtiles" /data/nairobi.pmtiles \
    --bbox="$BBOX" --maxzoom=15
ls -lh var/tiles/nairobi.pmtiles
