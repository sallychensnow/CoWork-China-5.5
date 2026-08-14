#!/bin/bash
# CoWork China - Quick Deploy (run on any machine with Docker + snow CLI)
# 只需 3 步: build → push → service
set -e

REPO="sfseapac-ding-aws-1.registry.snowflakecomputing.com/cowork/app/images"
TAG="v1"

echo "🔑 Step 1: Login to registry"
snow spcs image-registry login --connection china_dev

echo "🏗️  Step 2: Build & Push"
cd "$(dirname "$0")/.."
docker build -f deploy/Dockerfile.unified -t ${REPO}/cowork-china:${TAG} .
docker push ${REPO}/cowork-china:${TAG}

echo "🚀 Step 3: Create Service"
snow sql --connection china_dev -q "
CREATE SERVICE IF NOT EXISTS COWORK.APP.COWORK_SERVICE
  IN COMPUTE POOL COWORK_POOL
  FROM SPECIFICATION \$\$
spec:
  containers:
    - name: cowork
      image: ${REPO}/cowork-china:${TAG}
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

echo "✅ Done! Check status:"
echo "  snow sql --connection china_dev -q \"SHOW ENDPOINTS IN SERVICE COWORK.APP.COWORK_SERVICE\""
