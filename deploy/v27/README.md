# CoWork China v27 部署指南 / Deployment Guide

本目录可在一个全新的 Snowflake 中国区账号中复现参考环境（v27）：相同的表结构、演示数据、语义模型、知识库、Agent 配置和应用镜像。
This folder reproduces the v27 reference environment in a fresh Snowflake China-region account.

## 前置条件 / Prerequisites
- Snowflake 中国区账号，ACCOUNTADMIN（或具备创建 Database / Compute Pool / Integration 权限的角色），已开通 SPCS 与 Cortex Search
- 本地：Docker、Snowflake CLI (`snow`)，并已配置连接 `snow connection add`
- 阿里云 DashScope (通义千问) API Key

## 一键部署 / One-shot
1. 编辑 `01_setup.sql`，把 `<YOUR_DASHSCOPE_API_KEY>` 替换为真实 Key（**不要提交到 Git**）。
2. 在仓库根目录执行：
   ```bash
   CONN=<your_snow_connection> ./deploy/v27/deploy.sh
   ```
3. 等待服务 READY（首次约 5–10 分钟），获取访问地址：
   ```sql
   SELECT SYSTEM$GET_SERVICE_STATUS('COWORK.APP.COWORK_SERVICE');
   SHOW ENDPOINTS IN SERVICE COWORK.APP.COWORK_SERVICE;
   ```
   用浏览器打开 `ingress_url`，使用 Snowflake 账号登录。

## 分步说明 / Step by step
| 文件 | 内容 |
|---|---|
| `01_setup.sql` | Database / Schema / Warehouse / 镜像仓库 / Stage / Compute Pool / 网络规则 / EAI / Secret |
| `02_tables.sql` | 17 张表结构（从参考环境导出） |
| `03_load_data.sql` | 加载 `data/*.csv` 演示数据；上传语义模型与 Skills 到 Stage（需在仓库根目录运行） |
| `04_search_service.sql` | 创建 Cortex Search 服务 `COWORK.DATA.DOC_SEARCH_SERVICE` |
| `05_create_service.sql` | 创建 SPCS 服务（替换 `<REGISTRY_URL>`） |
| `deploy.sh` | 以上全部 + 镜像 build/push |

## 升级 / Upgrade
构建新 tag 后，`ALTER SERVICE ... FROM SPECIFICATION` 与 `SET EXTERNAL_ACCESS_INTEGRATIONS` 必须**分两条语句**执行；spec 中**不要**设置 `SNOWFLAKE_HOST` / `SNOWFLAKE_ACCOUNT`（SPCS 自动注入，手动设置会导致登录失败）。

## 本地开发 / Local dev
后端在非 SPCS 环境下使用 `SNOWFLAKE_CONNECTION_NAME` 环境变量指定的 snow 连接（默认 `default`）。

## 已知限制（原型）/ Known limitations
- 深度研究：ArcticSwarm 240s 超时，超时后由 qwen-plus 单次生成兜底报告；Web 搜索默认关闭。
- Text-to-SQL：为自研实现（语义模型 YAML + qwen-plus 生成 SQL），尚无准确性评测集；查询结果只把行数和 SQL 回传给 LLM。
- `python_exec` 工具为占位实现，未接入沙箱。
- 未实现：按用户角色透传权限、审计日志、AI 安全护栏、监控告警、CI/CD。详见方案文档中的 Gap 分析。
- 演示数据为模拟数据，客户需替换为自己的数据并更新语义模型。
