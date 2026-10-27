#!/bin/bash
# CoWork China v27 - one-shot deploy.  Usage:  CONN=<snow_connection> ./deploy/v27/deploy.sh
# Prereq: Docker, snow CLI, DashScope key already set in 01_setup.sql
set -euo pipefail
CONN="${CONN:?set CONN to your snow connection name}"
TAG="${TAG:-v27}"
cd "$(dirname "$0")/../.."

snow sql -c "$CONN" -f deploy/v27/01_setup.sql
snow sql -c "$CONN" -f deploy/v27/02_tables.sql
snow sql -c "$CONN" -f deploy/v27/03_load_data.sql
snow sql -c "$CONN" -f deploy/v27/04_search_service.sql

REGISTRY=$(snow spcs image-registry url -c "$CONN")
IMAGE="$REGISTRY/cowork/app/images/cowork:$TAG"
snow spcs image-registry login -c "$CONN"
docker build --platform linux/amd64 -t "$IMAGE" .
docker push "$IMAGE"

sed -e "s#<REGISTRY_URL>#$REGISTRY#" -e "s#cowork:v27#cowork:$TAG#" deploy/v27/05_create_service.sql > /tmp/cowork_create_service.sql
snow sql -c "$CONN" -f /tmp/cowork_create_service.sql
echo "Service starting. Check: snow sql -c $CONN -q \"SELECT SYSTEM\$GET_SERVICE_STATUS('COWORK.APP.COWORK_SERVICE')\""
