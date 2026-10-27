# CoWork China 5.0 — 技术文档 (Image v15)

> Snowflake CoWork 中国版：基于 SPCS 的企业级 AI 数据分析平台，集成 Cortex Analyst (Text-to-SQL)、Cortex Search (RAG)、ArcticSwarm 多智能体框架，适配中国区通义千问大模型。

---

## 一、技术栈总览

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | Next.js 15 + React 19 + TypeScript | App Router, standalone output 模式 |
| **UI 组件** | Tailwind CSS 4 + Recharts 3 | 暗色主题，响应式图表 |
| **Markdown 渲染** | react-markdown + remark-gfm + mermaid | 表格/代码/流程图 |
| **后端** | FastAPI 0.115 + Python 3.11 | 异步 API，SSE 流式输出 |
| **LLM 调用** | DashScope API (OpenAI 兼容) | 模型: qwen-plus (默认) / qwen-max |
| **数据库** | Snowflake (中国区) | Connector Python 3.6+ |
| **搜索** | Cortex Search Service | 知识库 RAG 检索 |
| **Text-to-SQL** | Cortex Analyst (Semantic Model YAML) | LLM 生成 SQL → 执行 → 图表 |
| **多智能体** | ArcticSwarm | 子任务拆解、并行执行 |
| **部署** | SPCS (Snowpark Container Services) | 单容器，OAuth 认证 |
| **容器** | Docker multi-stage build | node:20-alpine + python:3.11-slim |

---

## 二、项目结构

```
snowflake-cowork-china/
├── frontend/                    # Next.js 15 前端
│   ├── src/
│   │   ├── app/                 # 页面路由
│   │   │   ├── page.tsx         # 主聊天页面
│   │   │   ├── agents/          # 智能体选择页
│   │   │   ├── capabilities/    # 配置管理页 (Skills/SV/Search/Agents)
│   │   │   ├── models/          # 模型选择页
│   │   │   └── demo/            # Demo 引导页
│   │   ├── components/
│   │   │   ├── ChatView.tsx     # 聊天主视图 (消息列表 + 输入)
│   │   │   ├── MessageBubble.tsx # 消息气泡 (Markdown + 图表 + 表格)
│   │   │   ├── ChartCard.tsx    # 图表卡片 (Recharts, View SQL 按钮)
│   │   │   ├── TableCard.tsx    # 表格卡片 (View SQL 按钮)
│   │   │   ├── InputArea.tsx    # 输入框 + PlusMenu
│   │   │   ├── PlusMenu.tsx     # 深度研究开关 + Skill 选择
│   │   │   ├── Sidebar.tsx      # 侧边栏 (对话历史 + 导航)
│   │   │   ├── AgentPicker.tsx  # 智能体选择器
│   │   │   ├── ThinkingDisplay.tsx # 思考过程展示
│   │   │   ├── UserMenu.tsx     # 设置面板 (用户信息/主题/语言)
│   │   │   ├── WelcomeScreen.tsx # 欢迎页
│   │   │   ├── capabilities/    # 配置管理子组件
│   │   │   │   ├── AgentsTab.tsx      # 智能体 CRUD + Skills 绑定
│   │   │   │   ├── SkillsTab.tsx      # Skill 导入管理
│   │   │   │   ├── SemanticViewsTab.tsx # 语义视图/模型管理
│   │   │   │   └── SearchServicesTab.tsx # Cortex Search 管理
│   │   │   └── sv/              # 语义视图创建向导
│   │   │       ├── SVWizard.tsx        # 5 步向导主组件
│   │   │       ├── TableSelector.tsx   # Step 1: 选择表
│   │   │       ├── ColumnEditor.tsx    # Step 2: 列分类
│   │   │       ├── RelationshipEditor.tsx # Step 3: 关系定义
│   │   │       ├── VQREditor.tsx       # Step 4: Verified Queries
│   │   │       └── DeployPanel.tsx     # Step 5: 部署
│   │   ├── hooks/
│   │   │   └── useChat.ts       # 聊天核心 Hook (SSE 流式)
│   │   └── lib/
│   │       ├── types.ts         # TypeScript 类型定义
│   │       └── settings.tsx     # 全局设置 Context (主题/语言/用户)
│   └── next.config.ts           # API rewrites → localhost:8000
│
├── backend/                     # FastAPI 后端
│   ├── app/
│   │   ├── main.py              # FastAPI 应用入口
│   │   ├── routers/
│   │   │   ├── chat.py          # SSE 聊天流 /api/chat/stream
│   │   │   ├── agents.py        # 智能体 CRUD /api/agents/
│   │   │   ├── agent_config.py  # 配置 + 用户信息 /api/agent/
│   │   │   ├── skills.py        # Skill 导入 /api/skills/
│   │   │   ├── conversations.py # 对话历史 /api/conversations/
│   │   │   ├── sources.py       # 数据源发现 /api/sources/
│   │   │   ├── research.py      # 深度研究 /api/research/
│   │   │   └── sv.py            # 语义视图 Builder /api/sv/
│   │   └── services/
│   │       ├── agent_engine.py  # 核心: LLM 对话 + Tool Calling 循环
│   │       ├── llm_client.py    # DashScope/DeepSeek LLM 客户端
│   │       ├── tool_executor.py # 工具执行分发
│   │       ├── skills_engine.py # Skill 加载和触发
│   │       ├── deep_research.py # 深度研究 (多轮子查询)
│   │       ├── sv_service.py    # 语义视图 YAML 生成/部署
│   │       ├── swarm_bridge.py  # ArcticSwarm 多智能体桥接
│   │       └── tools/
│   │           ├── cortex_analyst.py # Text-to-SQL (DashScope API)
│   │           ├── cortex_search.py  # Cortex Search RAG 检索
│   │           └── python_exec.py    # Python 代码执行
│   └── semantic_models/         # 语义模型 YAML (打包进 Docker)
│       ├── retail_model.yaml
│       ├── logistics_model.yaml
│       ├── procurement_model.yaml
│       └── manufacturing_model.yaml
│
├── deploy/                      # 部署脚本和配置
│   ├── demo_data.sql            # 13 张 Demo 表 + 知识库
│   ├── preset_agents.sql        # 4 个预设智能体
│   ├── spcs-spec.yaml           # SPCS 服务规格
│   └── demo_guide.md            # Demo 演示指南
│
└── Dockerfile                   # Multi-stage: frontend build + backend
```

---

## 三、核心功能

### 3.1 Cortex Analyst (Text-to-SQL)

用户用自然语言提问 → LLM 根据 Semantic Model YAML 生成 SQL → 在 Snowflake 执行 → 返回图表/表格。

**数据流**:
```
用户提问 → agent_engine.py (Tool Calling)
  → cortex_analyst.py._generate_sql()
    → DashScope API (qwen-plus) + Semantic Model YAML → 生成 SQL
  → cortex_analyst.py._execute_sql()
    → Snowflake Connector → 查询结果
  → cortex_analyst.py._build_display_hint()
    → {type: "chart"/"table", data: ..., sql: "SELECT ..."} → 前端渲染
```

**View SQL**: 用户可点击图表/表格底部的 "View SQL" 按钮查看实际执行的 SQL 语句。

### 3.2 Cortex Search (RAG)

基于 Cortex Search Service 进行知识库检索，用于回答政策、流程、规范类问题。

- Service: `COWORK.DATA.DOC_SEARCH_SERVICE`
- 数据源: `KNOWLEDGE_BASE` 表 (40 篇文档，覆盖零售/物流/采购/制造)
- 搜索列: CONTENT (全文), TITLE, CATEGORY (属性过滤)

### 3.3 深度研究 (Deep Research)

Agent 配置中默认启用，但需要用户在 PlusMenu 手动开启当次对话的深度研究。启用后 LLM 可以调用 `deep_research` 工具进行多轮子查询和综合分析。

### 3.4 智能体 (Agents)

每个 Agent 绑定:
- **Semantic Models**: 指定哪些 YAML 模型可查询
- **Search Services**: 指定哪些搜索服务可用
- **Tools**: 启用的工具列表 (cortex_analyst, cortex_search, deep_research)
- **Skills**: 绑定的预定义工作流
- **System Prompt**: 自定义系统提示词

### 3.5 Skills

预定义的工作流模板，用户通过 `/` 斜杠命令触发。Skill 文件为 `.md` 格式，包含 YAML frontmatter (name, trigger, icon, category) + Markdown prompt 内容。

### 3.6 语义视图 Builder

5 步向导创建 Semantic View:
1. **选择表** — 从 Snowflake 数据库中选择表，自动提取元数据
2. **列分类** — 自动分类为 dimension / time_dimension / fact
3. **关系定义** — 定义表间 many_to_one / one_to_one 关系
4. **VQR** — 添加多条 Verified Queries (问答对)
5. **部署** — 生成 YAML → 上传到 Stage 或创建 Semantic View 对象

---

## 四、Snowflake 后端服务

### 4.1 账号信息

| 配置项 | 值 |
|--------|-----|
| 账号 | <your_account> |
| 数据库 | COWORK |
| Schema | APP (应用配置), DATA (业务数据) |
| 仓库 | COWORK_WH (XSMALL) |
| 计算池 | COWORK_POOL (CPU_X64_XS, 1 node) |
| 服务 | COWORK.APP.COWORK_SERVICE |
| 端点 | https://juaejm-sfcsupportchina-sallytesting.snowflake-app.cn |
| 镜像仓库 | COWORK.APP.IMAGES |

### 4.2 数据表

**COWORK.DATA** (业务数据 — 13 张表):

| 表名 | 场景 | 行数 | 说明 |
|------|------|------|------|
| RETAIL_CUSTOMERS | 零售 | 50 | 客户信息 (地区/等级) |
| RETAIL_PRODUCTS | 零售 | 20 | 商品信息 (类别/品牌/价格) |
| RETAIL_ORDERS | 零售 | ~485 | 销售订单 (2025-07 ~ 2026-10) |
| LOGISTICS_WAREHOUSES | 物流 | 10 | 仓库信息 |
| LOGISTICS_VEHICLES | 物流 | 30 | 车辆信息 |
| LOGISTICS_SHIPMENTS | 物流 | 800 | 运单数据 |
| PROCUREMENT_SUPPLIERS | 采购 | 25 | 供应商信息 |
| PROCUREMENT_MATERIALS | 采购 | 30 | 物料信息 |
| PROCUREMENT_PO | 采购 | ~374 | 采购订单 |
| MFG_PRODUCTION_LINES | 制造 | 8 | 产线信息 |
| MFG_WORK_ORDERS | 制造 | ~621 | 生产工单 |
| MFG_QUALITY_RECORDS | 制造 | 300 | 质检记录 |
| KNOWLEDGE_BASE | 通用 | 40 | 知识库文档 |

**COWORK.APP** (应用配置):

| 对象 | 类型 | 说明 |
|------|------|------|
| AGENTS | TABLE | 智能体定义 (4 预设) |
| SKILLS | TABLE | Skill 定义 (ID 自增) |
| CHAT_SESSIONS | TABLE | 对话会话 |
| CHAT_MESSAGES | TABLE | 对话消息 |
| SEMANTIC_MODELS | STAGE | 语义模型 YAML (4 文件) |
| SKILLS | STAGE | Skill 文件 |
| IMAGES | IMAGE REPOSITORY | Docker 镜像仓库 |
| COWORK_DASHSCOPE_KEY | SECRET | DashScope API Key |
| COWORK_SERVICE | SERVICE | SPCS 应用服务 |

### 4.3 Cortex Search Service

```sql
CREATE CORTEX SEARCH SERVICE COWORK.DATA.DOC_SEARCH_SERVICE
  ON CONTENT
  ATTRIBUTES TITLE, CATEGORY
  WAREHOUSE = COWORK_WH
  TARGET_LAG = '1 hour'
  AS (SELECT CONTENT, TITLE, CATEGORY FROM COWORK.DATA.KNOWLEDGE_BASE);
```

### 4.4 External Access Integration

```sql
-- 网络规则: 允许访问 DashScope API
CREATE NETWORK RULE COWORK.APP.COWORK_LLM_RULE
  MODE = EGRESS TYPE = HOST_PORT
  VALUE_LIST = ('dashscope.aliyuncs.com:443');

-- 外部访问集成
CREATE EXTERNAL ACCESS INTEGRATION COWORK_LLM_ACCESS
  ALLOWED_NETWORK_RULES = (COWORK.APP.COWORK_LLM_RULE)
  ALLOWED_AUTHENTICATION_SECRETS = (COWORK.APP.COWORK_DASHSCOPE_KEY)
  ENABLED = TRUE;
```

### 4.5 预设智能体

| ID | 名称 | 语义模型 | 说明 |
|----|------|---------|------|
| retail_analyst | 零售分析师 | retail_model.yaml | 电商销售数据 |
| logistics_mgr | 物流管家 | logistics_model.yaml | 物流运输数据 |
| procurement_asst | 采购助手 | procurement_model.yaml | 采购供应链 |
| mfg_quality | 制造质量官 | manufacturing_model.yaml | 生产质量数据 |

---

## 五、API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/chat/stream | SSE 聊天流 (Tool Calling 循环) |
| GET | /api/agent/greeting | 时间感知问候语 |
| GET | /api/agent/user-info | 用户身份信息 (SHOW USERS) |
| GET/PUT | /api/agent/config | 全局 Agent 配置 |
| GET | /api/agent/models | 可用模型列表 |
| GET | /api/agents/ | 列出所有智能体 |
| POST | /api/agents/ | 创建智能体 |
| PUT | /api/agents/{id} | 更新智能体 |
| DELETE | /api/agents/{id} | 删除智能体 |
| GET | /api/skills/ | 列出所有 Skill |
| POST | /api/skills/import | 导入 Skill (.md) |
| GET | /api/conversations/ | 对话列表 |
| GET | /api/conversations/{id}/messages | 对话消息 |
| GET | /api/sources/databases | 数据库列表 |
| GET | /api/sources/schemas | Schema 列表 |
| GET | /api/sources/search-services | 搜索服务列表 |
| GET | /api/sv/list | 语义视图 + YAML 列表 |
| POST | /api/sv/extract-metadata | 提取表元数据 |
| POST | /api/sv/generate | 生成语义模型 YAML |
| POST | /api/sv/deploy | 部署 YAML 到 Stage |
| POST | /api/research/deep | 深度研究接口 |

---

## 六、LLM 配置

| 参数 | 值 |
|------|-----|
| API 端点 | https://dashscope.aliyuncs.com/compatible-mode/v1 |
| 默认模型 | qwen-plus (128K context) |
| 备选模型 | qwen-max (32K, 最强推理), qwen-turbo (8K, 极速) |
| Temperature | 0.7 (可调) |
| API Key | 存储于 Snowflake Secret `COWORK.APP.COWORK_DASHSCOPE_KEY` |
| 协议 | OpenAI 兼容 (httpx 直调) |

**Tool Calling 流程**:
1. LLM 接收用户消息 + 工具 schema (cortex_analyst / cortex_search 等)
2. LLM 返回 tool_call → agent_engine 执行对应工具
3. 工具结果返回给 LLM → LLM 生成最终回答
4. 全程 SSE 流式输出 (thinking → tool_start → tool_result → content → done)

---

## 七、Docker 构建

**Multi-stage build** (Dockerfile):

- **Stage 1**: `node:20-alpine` — 构建 Next.js standalone
- **Stage 2**: `python:3.11-slim` — 安装 Python 依赖 + ArcticSwarm + 复制前端构建产物

**启动方式**: 单容器双进程
- Backend: `uvicorn app.main:app --port 8000` (后台)
- Frontend: `node server.js` (端口 3000, Next.js rewrites → 8000)

**构建命令**:
```bash
docker build --platform linux/amd64 -t cowork-china:v10 .
```

---

## 八、完整部署步骤

### Step 1: Snowflake 基础设施

```sql
-- 数据库和 Schema
CREATE DATABASE IF NOT EXISTS COWORK;
CREATE SCHEMA IF NOT EXISTS COWORK.APP;
CREATE SCHEMA IF NOT EXISTS COWORK.DATA;

-- 仓库
CREATE WAREHOUSE IF NOT EXISTS COWORK_WH
  WAREHOUSE_SIZE='XSMALL' AUTO_SUSPEND=60 AUTO_RESUME=TRUE;

-- 计算池
CREATE COMPUTE POOL IF NOT EXISTS COWORK_POOL
  MIN_NODES=1 MAX_NODES=1
  INSTANCE_FAMILY=CPU_X64_XS
  AUTO_RESUME=TRUE AUTO_SUSPEND_SECS=300;

-- 镜像仓库
CREATE IMAGE REPOSITORY IF NOT EXISTS COWORK.APP.IMAGES;

-- Stage
CREATE STAGE IF NOT EXISTS COWORK.APP.SEMANTIC_MODELS ENCRYPTION=(TYPE='SNOWFLAKE_SSE');
CREATE STAGE IF NOT EXISTS COWORK.APP.SKILLS ENCRYPTION=(TYPE='SNOWFLAKE_SSE');

-- 应用表
CREATE TABLE IF NOT EXISTS COWORK.APP.AGENTS (
  ID VARCHAR DEFAULT UUID_STRING(),
  NAME VARCHAR NOT NULL,
  DESCRIPTION VARCHAR,
  SEMANTIC_MODELS VARIANT,
  SEARCH_SERVICES VARIANT,
  TOOLS VARIANT,
  SYSTEM_PROMPT TEXT,
  ICON VARCHAR DEFAULT '🤖',
  SKILLS VARIANT,
  CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS COWORK.APP.SKILLS (
  ID NUMBER AUTOINCREMENT,
  NAME VARCHAR NOT NULL,
  DESCRIPTION VARCHAR,
  TRIGGER_TEXT VARCHAR,
  ICON VARCHAR DEFAULT '🔧',
  CATEGORY VARCHAR DEFAULT '通用',
  PROMPT TEXT NOT NULL,
  AGENT_ID VARCHAR DEFAULT '',
  IS_GLOBAL BOOLEAN DEFAULT FALSE,
  CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS COWORK.APP.CHAT_SESSIONS (
  SESSION_ID VARCHAR DEFAULT UUID_STRING(),
  USER_ID VARCHAR,
  TITLE VARCHAR DEFAULT '新对话',
  AGENT_ID VARCHAR,
  CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  UPDATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS COWORK.APP.CHAT_MESSAGES (
  ID NUMBER AUTOINCREMENT,
  SESSION_ID VARCHAR NOT NULL,
  ROLE VARCHAR NOT NULL,
  CONTENT TEXT,
  QUERY_RESULT TEXT,
  CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- Secret (DashScope API Key)
CREATE SECRET IF NOT EXISTS COWORK.APP.COWORK_DASHSCOPE_KEY
  TYPE = GENERIC_STRING
  SECRET_STRING = '<your-dashscope-api-key>';

-- 网络规则 + 外部访问集成
CREATE OR REPLACE NETWORK RULE COWORK.APP.COWORK_LLM_RULE
  MODE = EGRESS TYPE = HOST_PORT
  VALUE_LIST = ('dashscope.aliyuncs.com:443');

CREATE OR REPLACE EXTERNAL ACCESS INTEGRATION COWORK_LLM_ACCESS
  ALLOWED_NETWORK_RULES = (COWORK.APP.COWORK_LLM_RULE)
  ALLOWED_AUTHENTICATION_SECRETS = (COWORK.APP.COWORK_DASHSCOPE_KEY)
  ENABLED = TRUE;
```

### Step 2: Demo 数据

```bash
# 加载 13 张业务表 + 40 篇知识库文档
snow sql -c <connection> --database COWORK --schema DATA -f deploy/demo_data.sql
```

### Step 3: Cortex Search Service

```sql
CREATE OR REPLACE CORTEX SEARCH SERVICE COWORK.DATA.DOC_SEARCH_SERVICE
  ON CONTENT
  ATTRIBUTES TITLE, CATEGORY
  WAREHOUSE = COWORK_WH
  TARGET_LAG = '1 hour'
  AS (SELECT CONTENT, TITLE, CATEGORY FROM COWORK.DATA.KNOWLEDGE_BASE);
```

### Step 4: 语义模型上传

```bash
# 上传 4 个行业语义模型到 Stage
snow stage copy backend/semantic_models/retail_model.yaml @COWORK.APP.SEMANTIC_MODELS/ --overwrite -c <connection>
snow stage copy backend/semantic_models/logistics_model.yaml @COWORK.APP.SEMANTIC_MODELS/ --overwrite -c <connection>
snow stage copy backend/semantic_models/procurement_model.yaml @COWORK.APP.SEMANTIC_MODELS/ --overwrite -c <connection>
snow stage copy backend/semantic_models/manufacturing_model.yaml @COWORK.APP.SEMANTIC_MODELS/ --overwrite -c <connection>
```

### Step 5: 预设智能体

```bash
snow sql -c <connection> -f deploy/preset_agents.sql
```

### Step 6: Docker 构建 & 推送

```bash
# 构建 (必须 linux/amd64)
docker build --platform linux/amd64 -t cowork-china:v10 .

# Tag
docker tag cowork-china:v10 <account>.registry.snowflakecomputing.cn/cowork/app/images/cowork-china:v10

# 登录 (密码用 PAT 或账号密码)
docker login <account>.registry.snowflakecomputing.cn -u <user>

# 推送
docker push <account>.registry.snowflakecomputing.cn/cowork/app/images/cowork-china:v10
```

### Step 7: 创建 SPCS 服务

```sql
CREATE SERVICE COWORK.APP.COWORK_SERVICE
  IN COMPUTE POOL COWORK_POOL
  MIN_INSTANCES = 1
  MAX_INSTANCES = 1
  QUERY_WAREHOUSE = COWORK_WH
  EXTERNAL_ACCESS_INTEGRATIONS = (COWORK_LLM_ACCESS)
  FROM SPECIFICATION $$
spec:
  containers:
    - name: cowork
      image: /COWORK/APP/IMAGES/cowork-china:v15
      env:
        SNOWFLAKE_WAREHOUSE: COWORK_WH
        SNOWFLAKE_DATABASE: COWORK
        SNOWFLAKE_SCHEMA: DATA
        USE_ARCTICSWARM: "true"
        LLM_MODEL: "qwen-plus"
        LLM_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
      secrets:
        - snowflakeSecret: COWORK.APP.COWORK_DASHSCOPE_KEY
          secretKeyRef: secret_string
          envVarName: DASHSCOPE_API_KEY
      resources:
        requests:
          cpu: "1"
          memory: 2Gi
        limits:
          cpu: "2"
          memory: 4Gi
  endpoints:
    - name: app
      port: 3000
      public: true
  networkPolicyConfig:
    allowInternetEgress: true
$$;
```

### Step 8: 验证

```sql
-- 检查服务状态
SELECT SYSTEM$GET_SERVICE_STATUS('COWORK.APP.COWORK_SERVICE');
-- 期望: status = "READY", image = "...cowork-china:v10"

-- 获取访问 URL
SHOW ENDPOINTS IN SERVICE COWORK.APP.COWORK_SERVICE;
```

### 版本更新

```sql
-- 推送新镜像后，ALTER SERVICE 切换版本
ALTER SERVICE COWORK.APP.COWORK_SERVICE
  FROM SPECIFICATION $$ ... (使用新版本 image tag) ... $$;
```

---

## 九、ArcticSwarm 集成架构

CoWork 5.0 通过三层桥接模块将 [ArcticSwarm](https://github.com/Snowflake-Labs/arctic-swarm) 多智能体框架嵌入到 CoWork 的 FastAPI 后端中，实现了在中国网络环境下的深度研究（Deep Research）功能。

### 9.1 ArcticSwarm 框架概述

ArcticSwarm 是 Snowflake 开源的**多智能体长时研究框架**（Python 3.11+，Apache 2.0），专为开放性 Web 研究任务设计。其核心创新在于**延迟共识（deferred consensus）**机制 —— 在传统多智能体系统中，投票/共识策略容易在早期锁定一个「看似合理但不正确」的假设；ArcticSwarm 将「过早共识」视为首要故障模式，通过隔离式公告板（Gated BBS）让各子智能体先独立研究，再交叉验证。

#### 核心组件

| 组件 | 职责 |
|------|------|
| **SwarmOrchestrator** | 主控智能体：分解研究问题、动态创建任务、监控 BBS、生成最终报告 |
| **SubAgent** | 持久工作线程：从 TaskBoard 认领任务、执行工具调用循环、将结果发布到 BBS |
| **BBS (Bulletin Board System)** | 带隔离门控的公告板 —— 研究阶段只写不读，审查阶段读写全开 |
| **TaskBoard** | 线程安全的任务生命周期管理（PENDING → CLAIMED → RUNNING → COMPLETED/FAILED） |
| **Agent** | 底层智能体循环 —— 管理对话历史、工具调度、LLM 重试、上下文压缩 |
| **ToolFactory** | 中央工具注册表，按 YAML profile 动态构建工具集 |
| **LLM Client** | 多 Provider 抽象层（Anthropic / OpenAI / Azure / vLLM-Qwen） |

#### 运行流程 (`run_swarm_turn`)

```
1. 初始化
   ├── 创建/复用 BBS、新建 TaskBoard + AgentRegistry
   ├── 启动 ThreadPoolExecutor (max_subagents=16)
   └── 构建 SwarmContext（共享引用容器）

2. 编排器 Agent 运行
   ├── 调用 create_task() 分解问题为子任务
   ├── 每个 create_task 自动 spawn SubAgent
   ├── SubAgent 在独立线程中执行研究
   │   ├── 隔离模式：可写 BBS 但不可读（独立假设）
   │   ├── 使用 web_search / web_fetch / 自定义工具
   │   └── 完成后发布发现到 BBS
   ├── 编排器监控 TaskBoard + BBS
   └── 触发 rival-sweep（当首个候选答案出现时自动生成对立观点任务）

3. 审查阶段
   ├── BBS 解锁读权限 → 子智能体交叉阅读
   ├── Reviewer 发布结构化判定：VERIFIED / CHALLENGE / ALTERNATIVE
   └── prepare_report 门控：需 dedicated reviewer + builder-as-reviewer 双重确认

4. 报告生成
   ├── send_user_markdown_report 输出最终报告
   ├── 可选 Layer 4a: critic-refine 约束验证循环
   └── 发射 SwarmComplete 事件
```

#### 关键设计模式

- **BBS 隔离门控**: 研究阶段子智能体只写不读，产生 N 个真正独立的假设，而非 N 个相关联的样本。审查阶段才解锁读权限进行交叉验证
- **反过早锁定（Alt-task guard）**: 编排器必须至少创建一个「对立/替代」任务，`prepare_report` 才会解锁，防止过早收敛
- **审查多样性门控（Reviewer-diversity gate）**: 最终报告需要 dedicated reviewer 和 builder-as-reviewer 两类不同角色同时给出 VERIFIED 判定
- **预算感知收尾**: 到达 timeout 的 90% 时，自动阻断子智能体的 Web 工具并注入「立即提交发现」的紧急指令
- **多 Provider 回退梯**: 空/拒绝响应触发级联重试 → 降低推理强度 → 无推理重试 → 跨模型 fallback → 终止
- **心跳进度追踪**: 每次工具调用更新 `TaskBoard.bump_progress()`，编排器通过 `list_tasks` 获取实时活动状态

#### LLM Provider 路由

`detect_provider(model)` 根据模型名自动选择客户端：

| 模型名特征 | Provider | 客户端 |
|-----------|----------|--------|
| 含 `qwen` / `tongyi` | vllm | `VLLMChatLLMClient` (OpenAI 兼容) |
| `gpt-` / `openai-` 前缀 | openai | `OpenAIResponsesLLMClient` |
| 其他（默认） | anthropic | `AnthropicLLMClient` |

`VLLMChatLLMClient` 专门处理 Qwen 系列：thinking toggle（`enable_thinking`）、动态输出预算计算、自动剥离 `<think>...</think>` 链式推理标签。

#### 事件系统

Swarm 级事件（由 `on_swarm_event` 回调接收）：

| 事件 | 触发时机 |
|------|---------|
| `SwarmStarted` | 编排器开始处理 |
| `SubagentSpawned` / `SubagentClaimedTask` | 子智能体创建/认领任务 |
| `TeammateCompleted` / `TeammateFailed` | 子任务完成/失败 |
| `OrchestratorToolCall` / `TeammateToolCall` | 工具调用 |
| `ReportStarted` / `ReportDelta` | 报告流式生成 |
| `SwarmComplete` | 全部完成，含 answer、duration、token_usage |

### 9.2 CoWork 集成调用链

CoWork 通过三个桥接模块（`arcticswarm_tools.py`、`arcticswarm_llm.py`、`swarm_bridge.py`）将上述 ArcticSwarm 能力接入 FastAPI 后端，并提供了一个不依赖 ArcticSwarm 的独立 fallback 实现（`deep_research.py`）。

```
用户 → 前端 PlusMenu 开启「深度研究」
     → agent_engine.py (ReAct loop)
        → LLM 返回 tool_call: deep_research
           → SSE: deep_research_async 事件
              → 前端发起 /api/agent/deep-research 请求
                 → swarm_bridge.py (ArcticSwarm 模式)
                    或 deep_research.py (独立模式)
```

### 9.3 工具桥接 — `arcticswarm_tools.py`

ArcticSwarm 的子智能体通过 `BaseTool.execute()` 同步调用工具，而 CoWork 的工具（Cortex Analyst、Cortex Search、Web Search）是 async 的。此模块完成同步/异步桥接：

| 包装类 | ArcticSwarm tool name | 对应 CoWork 工具 | 说明 |
|--------|----------------------|-----------------|------|
| `ChinaWebSearchTool` | `web_search` | `tool_executor._exec_web_search` | 通过 Qwen enable_search 实现中国可用的网络搜索 |
| `CortexAnalystTool` | `query_snowflake_data` | `tool_executor._exec_cortex_analyst` | 自然语言查询结构化企业数据 |
| `CortexSearchTool` | `search_knowledge_base` | `tool_executor._exec_cortex_search` | RAG 检索企业文档 |

关键技术点：
- `_run_async()` 桥接函数处理两种情况：无事件循环时用 `asyncio.run()`，在已有事件循环（`asyncio.to_thread`）中启动新的 `ThreadPoolExecutor`
- `build_custom_tools()` 工厂函数按 agent_config 构建工具实例，传入语义模型和搜索服务配置

### 9.4 LLM 配置 — `arcticswarm_llm.py`

构建 `ArcticswarmConfig` 指向 DashScope（通义千问）API：

```python
ArcticswarmConfig(
    openai_api_key=api_key,
    openai_base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    model="qwen-plus",            # 模型名含 'qwen' → 路由到 VLLMChatLLMClient
    swarm_enabled=True,
    max_teammates=3,
    max_turns=30,
    web_search_enabled=False,     # 由 ChinaWebSearchTool 代替
    sf_connection_name="",        # CoWork 自行管理 Snowflake 连接
)
```

关键适配：ArcticSwarm 的 `detect_provider()` 识别 model 名中的 `qwen`/`tongyi` 关键字，自动选择 `VLLMChatLLMClient`（OpenAI 兼容协议），因此无需额外的 provider 配置。

### 9.5 编排桥接 — `swarm_bridge.py`

`run_arcticswarm_research()` 是核心编排入口，负责：

1. **构建配置与工具**: 调用 `build_china_config()` + `build_custom_tools()`
2. **注入自定义工具**: 通过 `ToolFactory._BUILDERS` 字典注入 CoWork 工具，使 ArcticSwarm 子智能体可以调用 Snowflake 原生服务
3. **后台线程执行**: `SwarmOrchestrator.run_swarm_turn()` 是同步阻塞的，通过 `asyncio.to_thread()` 在后台线程运行，保持 FastAPI 事件循环不阻塞
4. **事件映射**: 将 ArcticSwarm 的 `SwarmEvent` 映射为 CoWork 前端的 `agents_status` 格式

事件映射对照：

| ArcticSwarm Event | CoWork 前端状态 |
|-------------------|---------------|
| `SwarmStarted` | Orchestrator → running |
| `SubagentSpawned` | 新增 Agent → running |
| `SubagentClaimedTask` | 更新 Agent 的 task 描述 |
| `TeammateCompleted` / `TeammateFailed` | Agent → done |
| `ReportStarted` | 新增 Synthesizer → running |
| `ReportDelta` | 报告流式片段 |
| `SwarmComplete` | 全部 → done |

### 9.6 独立深度研究 — `deep_research.py`

当 ArcticSwarm 未安装或不可用时，CoWork 提供了独立的多智能体研究实现，直接使用 DashScope API：

```
Step 1: 任务分解（Orchestrator）
    LLM 将用户问题分解为 2-3 个独立子任务

Step 2: 并行研究（Research Agents）
    asyncio.gather() 并发执行，每个 Agent 独立调用 LLM
    启用 enable_search=True 获取网络搜索结果

Step 3: 综合报告（Synthesizer）
    汇总所有子任务结果，生成结构化研究报告
```

与 ArcticSwarm 模式的区别：
- 不依赖 ArcticSwarm 库，直接调用 DashScope API
- 超时控制更精细（单次调用 90s，综合报告 150s）
- 不支持 Snowflake 工具调用（仅用 LLM 知识 + 网络搜索）

### 9.7 触发流程 — `agent_engine.py`

ReAct 循环中 `deep_research` 的特殊处理：

1. 用户在前端 PlusMenu 开启「深度研究」，`request.deep_research = True`
2. `_get_enabled_tools()` 将 `deep_research` 加入可用工具列表
3. LLM 判断需要深度研究时返回 `tool_call: deep_research`
4. `agent_engine` 不执行该工具，而是：
   - 发送 `deep_research_async` SSE 事件给前端
   - 前端接收后发起独立的 `/api/agent/deep-research` POST 请求
   - 该请求在后台调用 `swarm_bridge.py`（或 `deep_research.py`），通过 SSE 流式推送进度和报告

这种异步 handoff 设计避免了在 ReAct 主循环中等待长时间的深度研究执行（可达 5 分钟），同时保持 SSE 连接活跃。

### 9.8 两个 Repo 的核心逻辑对比

#### ArcticSwarm（学术级多智能体框架）

Snowflake AI Research 出品，核心设计：
- **Bulletin Board System (BBS)** — 所有 agent 间通过一个带门控的公告板通信
- **隔离模式 (Isolation)** — subagent 研究时只能写不能读 BBS，防止过早共识
- **协作模式 (Collaboration)** — 研究完成后 reviewer 发出 `Challenge / Alternative / Verified` 结构化裁决
- **TaskBoard** — 任务生命周期管理（PENDING → CLAIMED → RUNNING → COMPLETED）
- **Orchestrator + SubAgent 线程池** — Orchestrator 是 lead agent，SubAgent 是长运行线程，自动领取任务
- **丰富的工具集** — web_search, web_fetch, pdf_read, run_snowflake_sql, cortex_search 等
- **LLM Client** — 支持 Anthropic Claude / OpenAI / ZhiPu GLM / vLLM-Qwen

#### CoWork China（全栈 AI Agent 平台）

China SE Team 面向国内客户，功能模块：
- **Chat** — 普通对话（SSE 流式）
- **Deep Research** — 多智能体研究（`deep_research.py`）
- **Cortex Analyst** — NL→SQL 数据分析
- **Cortex Search** — 向量检索 RAG
- **Skills** — 斜杠命令工作流
- **Multi-Agent** — Agent 切换（不同 system prompt + tools）

#### CoWork 独立 Deep Research 的现状与局限

`deep_research.py` 的当前实现是一个**极简版的 3 步流水线**：

```
Step 1: Planner — LLM 把问题拆成 2-3 个子任务
Step 2: N × Researcher — 并行调 LLM（enable_search=True），agent 之间完全没有交互
Step 3: Synthesizer — 把所有结果拼起来让 LLM 综合
```

**关键限制**：
- 没有 BBS / 公告板，agent 之间无通信
- 没有 review 机制（没有 Challenge/Alternative/Verified 裁决）
- 没有任务板（不能动态创建/领取任务）
- 没有隔离 vs 协作模式的切换
- 本质上只是「并行调 LLM + 拼结果」，不是真正的 multi-agent

### 9.9 集成方案与改动清单

#### 嵌入点

最佳嵌入点是**替换 `backend/app/services/deep_research.py`**，同时调整 `backend/app/routers/research.py`：

```
替换前:
  routers/research.py → services/deep_research.py → 直接 httpx 调 DashScope

替换后:
  routers/research.py → swarm_bridge.py → ArcticSwarm SwarmOrchestrator
                                            → BBS + TaskBoard + SubAgents
                                            → 自定义工具 (Cortex Analyst/Search/Web)
```

#### 涉及的文件和改动

| CoWork-China 文件 | 改动 |
|---|---|
| `services/deep_research.py` | **核心替换点** — 用 ArcticSwarm 的 `SwarmOrchestrator.run_swarm_turn()` 替换 Planner→Researcher→Synthesizer 流水线 |
| `routers/research.py` | 调整 `_run_research()` 调用方式，ArcticSwarm 的 orchestrator 是同步代码，需 `asyncio.to_thread()` 包装 |
| `services/arcticswarm_llm.py` | 构建 `ArcticswarmConfig` 注入 DashScope API key / base_url / model |
| `services/arcticswarm_tools.py` | 将 CoWork 的 Cortex Analyst / Cortex Search 注册到 ArcticSwarm 的 ToolFactory |
| `services/swarm_bridge.py` | 桥接层：运行 SwarmOrchestrator 后台线程 + SwarmEvent → CoWork agents_status 映射 |

**不需要改动的部分**：
- **Frontend** — Deep Research UI 已支持 polling（POST 启动 → GET 轮询状态），只需保持 API contract 不变
- **Chat / Cortex Analyst / Cortex Search / Skills** — 完全独立，不受影响
- **SPCS 部署** — Dockerfile 里加上 `pip install arcticswarm` 即可

#### 集成中解决的技术问题

| 问题 | 解决方案 |
|------|---------|
| **网络限制** — ArcticSwarm 原版 web_search/web_fetch 在国内被墙 | `ChinaWebSearchTool` 通过 Qwen `enable_search` 代替；`ArcticswarmConfig.web_search_enabled=False` 禁用原生搜索 |
| **同步 vs 异步** — ArcticSwarm 基于 `threading` 同步，CoWork 是 async FastAPI | `swarm_bridge.py` 用 `asyncio.to_thread()` + `asyncio.wait_for()` 桥接 |
| **进度回调** — 前端依赖 `on_progress(agents_status)` 实时更新 | `on_swarm_event` 回调将 SwarmEvent 映射到 CoWork 的 `[{id, role, task, status}]` 格式 |
| **超时控制** — CoWork 有硬超时，ArcticSwarm 研究可能耗时较长 | `timeout_seconds=300`（5 分钟）+ async wrapper 额外 30 秒缓冲 |
| **工具注入** — ArcticSwarm 子智能体需要调用 Snowflake 原生服务 | `_inject_custom_tools()` 通过 `ToolFactory._BUILDERS` 字典注入自定义工具 |
| **Snowflake 连接** — ArcticSwarm 自带 Snowflake 连接，CoWork 有自己的 | `ArcticswarmConfig.sf_connection_name=""` 禁用，工具内部使用 CoWork 自有连接 |

---

## 十、v10 变更记录

| 版本 | 主要变更 |
|------|---------|
| v6 | 初始 SPCS 部署，4 行业 Demo |
| v7 | 修复 LLM 404 (qwen3-235b-a22b → qwen-plus) |
| v8 | 修复 deep_research 误触发 + QWEN_COMPLETE UDF 替换为 DashScope API |
| v9 | 语义模型本地 fallback + DESC USER 解析改进 |
| **v10** | **View SQL 按钮** (替代 Explore), **邮箱/显示名修复** (SHOW USERS), **VQR 写入 YAML**, **Skills 导入修复**, **语义视图按钮横排** |
| **v11** | **RelationshipCreator 修复** (内联 SQL 唯一性分析), **Stage 部署文件名修复** (不再 tmpXXX), **语义视图 YAML 编辑器** (全屏 modal + 保存回 Stage) |
| **v12** | **关系推断空 YAML 崩溃修复**, 前端兼容 relationship_type 字段 |
| **v13** | **用户名显示修复** — greeting 不再覆盖 user-info 的 display_name |
| **v14** | **YAML Model 删除修复** — 区分 semantic_view (DROP) 和 semantic_model (REMOVE stage file) |
| **v15** | **SPCS 用户身份修复** — CURRENT_USER() 返回 service owner，改用 Sf-Context-Current-User header 作为 SHOW USERS 的查询主键 |

---

## 十一、已知限制

1. **单容器架构**: 前后端在同一容器内运行，无法独立扩展
2. **LLM 模型依赖外部 API**: 需要 DashScope 可用且有配额
3. **Cortex Search 延迟**: TARGET_LAG = 1 hour，新增知识库文档需等待索引刷新
4. **Tool Calling 单轮**: 每次 LLM 调用只能触发一个工具，复杂查询需多轮
5. **RBAC**: 当前所有用户共享相同的 Agent 列表，Agent 级别的权限控制尚未实现
