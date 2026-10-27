> **最新部署方式 / Latest deployment (v27):** 见 [`deploy/v27/README.md`](deploy/v27/README.md) — 一键复现完整环境（表结构、演示数据、语义模型、知识库、Agent、SPCS 服务）。旧的 `deploy/*.sql` 脚本仅供参考。

# CoWork — Snowflake AI Agent Platform (China Region)

基于 Snowflake SPCS 的全栈 AI Agent 平台，支持多 Agent 切换、Skills 工作流、Deep Research 多智能体协作、Cortex Analyst 数据分析等能力。

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 15 + Tailwind CSS)                           │
│  ├── Chat UI (streaming, Markdown, Mermaid, charts)             │
│  ├── Skills Panel (/ slash command)                             │
│  └── Agent Picker (multi-agent routing)                         │
├─────────────────────────────────────────────────────────────────┤
│  Backend (FastAPI + uvicorn)                                    │
│  ├── Agent Engine (system prompt builder, tool orchestration)   │
│  ├── Skills Engine (Snowflake-persisted skills)                 │
│  ├── Deep Research (multi-agent planning → research → synthesis)│
│  ├── Tool Executor (Cortex Analyst, Cortex Search, Web Search)  │
│  └── LLM Client (DashScope/DeepSeek, streaming SSE)            │
├─────────────────────────────────────────────────────────────────┤
│  Snowflake (Data Layer)                                         │
│  ├── COWORK.APP.SKILLS — Skills 定义表                          │
│  ├── COWORK.APP.AGENTS — Agent 配置表                           │
│  ├── Cortex Analyst — 语义模型 SQL 生成                          │
│  └── Cortex Search — 向量检索服务                                │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start (Local Dev)

### Prerequisites
- Python 3.11+
- Node.js 20+
- Snowflake account with SPCS enabled (or local connection via `snowflake-connector-python`)

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # 填入 API key 和 Snowflake 连接信息
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # http://localhost:3000 → proxy to :8000
```

## Database Initialization

在 Snowflake 中执行以下 SQL 初始化所需对象（详见 `deploy/setup.sql`）：

```sql
-- 1. 数据库 & Schema
CREATE DATABASE IF NOT EXISTS COWORK;
CREATE SCHEMA IF NOT EXISTS COWORK.APP;
CREATE SCHEMA IF NOT EXISTS COWORK.DATA;

-- 2. Warehouse
CREATE WAREHOUSE IF NOT EXISTS COWORK_WH
  WAREHOUSE_SIZE = 'X-SMALL'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE;

-- 3. Image Repository (for SPCS deployment)
CREATE IMAGE REPOSITORY IF NOT EXISTS COWORK.APP.IMAGES;

-- 4. Compute Pool
CREATE COMPUTE POOL IF NOT EXISTS COWORK_POOL
  MIN_NODES = 1  MAX_NODES = 2
  INSTANCE_FAMILY = CPU_X64_XS
  AUTO_SUSPEND_SECS = 300  AUTO_RESUME = TRUE;

-- 5. External Access Integration (LLM API egress)
CREATE OR REPLACE NETWORK RULE COWORK.APP.DASHSCOPE_RULE
  MODE = EGRESS  TYPE = HOST_PORT
  VALUE_LIST = ('dashscope.aliyuncs.com:443', 'api.deepseek.com:443');

CREATE OR REPLACE EXTERNAL ACCESS INTEGRATION COWORK_LLM_ACCESS
  ALLOWED_NETWORK_RULES = (COWORK.APP.DASHSCOPE_RULE)
  ENABLED = TRUE;

-- 6. Secret (API Key)
CREATE SECRET IF NOT EXISTS COWORK.APP.DASHSCOPE_KEY
  TYPE = GENERIC_STRING
  SECRET_STRING = 'sk-your-dashscope-key-here';

-- 7. Skills 表
CREATE TABLE IF NOT EXISTS COWORK.APP.SKILLS (
  ID NUMBER AUTOINCREMENT,
  NAME VARCHAR NOT NULL,
  DESCRIPTION VARCHAR,
  TRIGGER_TEXT VARCHAR,
  ICON VARCHAR DEFAULT '🔧',
  CATEGORY VARCHAR DEFAULT '通用',
  PROMPT TEXT NOT NULL,
  AGENT_ID VARCHAR NOT NULL,
  IS_GLOBAL BOOLEAN DEFAULT FALSE,
  CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- 8. Agents 表
CREATE TABLE IF NOT EXISTS COWORK.APP.AGENTS (
  ID VARCHAR NOT NULL PRIMARY KEY,
  NAME VARCHAR NOT NULL,
  DESCRIPTION VARCHAR,
  SYSTEM_PROMPT TEXT,
  MODEL VARCHAR DEFAULT 'qwen3-235b-a22b',
  TOOLS VARIANT,
  GREETING VARCHAR,
  CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);
```

## SPCS Deployment

```bash
# 1. Login to registry
snow spcs image-registry login -c <connection_name>

# 2. Build (multi-arch for SPCS)
podman build --platform linux/amd64 -t cowork-china:latest .

# 3. Tag & Push
podman tag localhost/cowork-china:latest \
  <account>.registry.snowflakecomputing.cn/cowork/app/images/cowork-china:latest
podman push <account>.registry.snowflakecomputing.cn/cowork/app/images/cowork-china:latest

# 4. Create or update service
ALTER SERVICE COWORK.APP.COWORK_SERVICE FROM SPECIFICATION $$
spec:
  containers:
  - name: app
    image: /cowork/app/images/cowork-china:latest
    resources:
      requests: { cpu: 0.5, memory: 1Gi }
      limits:   { cpu: 2,   memory: 4Gi }
    secrets:
    - snowflakeSecret: COWORK.APP.DASHSCOPE_KEY
      secretKeyRef: secret_string
      envVarName: DASHSCOPE_API_KEY
    env:
      LLM_BASE_URL: https://dashscope.aliyuncs.com/compatible-mode/v1
      LLM_MODEL: qwen3-235b-a22b
    readinessProbe:
      port: 3000
      path: /
  endpoints:
  - name: app
    port: 3000
    public: true
$$;
```

## Key Features

| Feature | Description |
|---------|-------------|
| Multi-Agent | 多 Agent 切换，每个 Agent 有独立 system prompt 和 tools |
| Skills | `/` 斜杠命令触发预定义工作流，prompt 作为用户消息发送 |
| Deep Research | 多智能体协作：Planner → N×Researcher → Synthesizer |
| Cortex Analyst | 自然语言 → SQL，自动识别语义模型 |
| Cortex Search | 向量检索文档，RAG 增强 |
| Streaming | SSE 流式输出 + thinking 展示 |
| Charts | 自动识别数据并渲染图表 (bar/line/pie) |
| Mermaid | 代码块自动渲染为流程图 |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DASHSCOPE_API_KEY` | Yes | 阿里云 DashScope API Key |
| `LLM_BASE_URL` | Yes | LLM API endpoint |
| `LLM_MODEL` | Yes | Model name (e.g. `qwen3-235b-a22b`) |
| `SNOWFLAKE_HOST` | SPCS only | Auto-set in container |
| `SNOWFLAKE_ACCOUNT` | Local dev | Snowflake account identifier |
| `SNOWFLAKE_WAREHOUSE` | Optional | Default: `COWORK_WH` |

## License

Internal use — Snowflake China SE Team.
