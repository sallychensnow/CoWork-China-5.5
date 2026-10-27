-- CoWork China v27 - 05 创建 SPCS 服务 / Create service
-- Replace <REGISTRY_URL> with the output of:
--   snow spcs image-registry url -c <your_conn>
-- NOTE: Do NOT set SNOWFLAKE_HOST / SNOWFLAKE_ACCOUNT - SPCS injects them.

CREATE SERVICE IF NOT EXISTS COWORK.APP.COWORK_SERVICE
  IN COMPUTE POOL COWORK_POOL
  FROM SPECIFICATION $$
spec:
  containers:
  - name: cowork
    image: <REGISTRY_URL>/cowork/app/images/cowork:v27
    env:
      SNOWFLAKE_DATABASE: COWORK
      SNOWFLAKE_SCHEMA: APP
      SNOWFLAKE_WAREHOUSE: COWORK_WH
      USE_ARCTICSWARM: "true"
    resources:
      requests: {memory: 4Gi, cpu: "1"}
      limits:   {memory: 6Gi, cpu: "1"}
    secrets:
    - snowflakeSecret:
        objectName: COWORK.APP.COWORK_DASHSCOPE_KEY
      secretKeyRef: secret_string
      envVarName: DASHSCOPE_API_KEY
  endpoints:
  - name: app
    port: 3000
    public: true
  networkPolicyConfig:
    allowInternetEgress: true
$$
  EXTERNAL_ACCESS_INTEGRATIONS = (COWORK_LLM_ACCESS)
  MIN_INSTANCES = 1 MAX_INSTANCES = 1;

-- Upgrading later (two separate statements):
--   ALTER SERVICE COWORK.APP.COWORK_SERVICE FROM SPECIFICATION $$ ...new image tag... $$;
--   ALTER SERVICE COWORK.APP.COWORK_SERVICE SET EXTERNAL_ACCESS_INTEGRATIONS = (COWORK_LLM_ACCESS);

SHOW ENDPOINTS IN SERVICE COWORK.APP.COWORK_SERVICE;
