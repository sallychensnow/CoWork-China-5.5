#!/bin/bash
# CoWork China - SPCS Deployment Script
# Prerequisites: Docker, snow CLI authenticated to china_dev connection
# Usage: bash deploy.sh

set -e

REPO_URL="sfseapac-ding-aws-1.registry.snowflakecomputing.com/cowork/app/images"
IMAGE_TAG="latest"
SERVICE_NAME="COWORK.APP.COWORK_SERVICE"
COMPUTE_POOL="COWORK_POOL"

echo "═══════════════════════════════════════════"
echo "  CoWork China - SPCS Deployment"
echo "═══════════════════════════════════════════"

# Step 1: Login to Snowflake Image Registry
echo ""
echo "▶ [1/5] Logging into Snowflake Image Registry..."
snow spcs image-registry login

# Step 2: Build unified image
echo ""
echo "▶ [2/5] Building Docker image..."
cd "$(dirname "$0")/.."
docker build -f deploy/Dockerfile.unified -t cowork-china:${IMAGE_TAG} .

# Step 3: Tag and push
echo ""
echo "▶ [3/5] Pushing image to Snowflake..."
docker tag cowork-china:${IMAGE_TAG} ${REPO_URL}/cowork-china:${IMAGE_TAG}
docker push ${REPO_URL}/cowork-china:${IMAGE_TAG}

# Step 4: Update secret with real API key (skip if already set)
echo ""
echo "▶ [4/5] Verifying secret..."
echo "   ⚠️  Remember to update COWORK.APP.COWORK_DASHSCOPE_KEY with your real DashScope API key:"
echo "   ALTER SECRET COWORK.APP.COWORK_DASHSCOPE_KEY SET SECRET_STRING = 'sk-your-real-key';"

# Step 5: Create/Replace SPCS Service
echo ""
echo "▶ [5/5] Creating SPCS Service..."
snow sql -q "
CREATE SERVICE IF NOT EXISTS ${SERVICE_NAME}
  IN COMPUTE POOL ${COMPUTE_POOL}
  FROM SPECIFICATION \$\$
spec:
  containers:
    - name: cowork
      image: ${REPO_URL}/cowork-china:${IMAGE_TAG}
      env:
        DASHSCOPE_API_KEY:
          type: secret
          name: cowork_dashscope_key
        SNOWFLAKE_WAREHOUSE: COWORK_WH
        SNOWFLAKE_DATABASE: COWORK
        SNOWFLAKE_SCHEMA: DATA
      resources:
        requests:
          cpu: 1
          memory: 2Gi
        limits:
          cpu: 2
          memory: 4Gi
  endpoints:
    - name: app
      port: 8000
      public: true
  networkPolicyConfig:
    allowInternetEgress: true
\$\$
  EXTERNAL_ACCESS_INTEGRATIONS = (COWORK_LLM_ACCESS)
  MIN_INSTANCES = 1
  MAX_INSTANCES = 1;
"

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Deployment complete!"
echo ""
echo "  Check status:"
echo "    snow sql -q \"SELECT SYSTEM\$GET_SERVICE_STATUS('${SERVICE_NAME}')\""
echo ""
echo "  Get endpoint URL:"
echo "    snow sql -q \"SHOW ENDPOINTS IN SERVICE ${SERVICE_NAME}\""
echo "═══════════════════════════════════════════"
