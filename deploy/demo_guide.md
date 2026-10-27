# CoWork China 5.0 + ArcticSwarm Demo Guide

## 环境信息

- **账号**: <your_account>
- **访问URL**: SPCS Service endpoint（执行 `SHOW ENDPOINTS IN SERVICE COWORK.APP.COWORK_SERVICE` 获取）
- **数据库**: COWORK (APP schema: agents/skills/stages, DATA schema: 业务数据)
- **LLM**: 通义千问 qwen3-235b-a22b (DashScope API)

## 预置数据概览

| 行业 | 表名 | 数据量 | Agent |
|------|------|--------|-------|
| 电商零售 | RETAIL_ORDERS / CUSTOMERS / PRODUCTS | ~550行 | 零售分析师 |
| 物流运输 | LOGISTICS_SHIPMENTS / VEHICLES / WAREHOUSES | ~840行 | 物流管家 |
| 采购供应链 | PROCUREMENT_PO / SUPPLIERS / MATERIALS | ~455行 | 采购助手 |
| 制造业 | MFG_WORK_ORDERS / PRODUCTION_LINES / QUALITY_RECORDS | ~930行 | 制造质量官 |
| 知识库 | KNOWLEDGE_BASE | 40篇文档 | 跨行业共用 |

---

## Demo 1：零售快速问答（Cortex Analyst + Cortex Search）

### 准备
1. 在左侧 Capabilities > Agents 中点击 **零售分析师** 设为当前使用

### 演示对话

**结构化查询（Cortex Analyst）：**
- "各区域的总销售额是多少？"
- "上个月卖得最好的5个产品是什么？"
- "电子产品和家电哪个品类销售额更高？"

**知识库检索（Cortex Search）：**
- "退货政策是什么？"
- "双十一有什么促销活动？"
- "会员等级有几种？各有什么权益？"

**组合问答：**
- "钻石会员有多少人？他们的平均客单价是多少？"

---

## Demo 2：物流运营分析

### 准备
1. 切换到 **物流管家** Agent

### 演示对话

**运营指标：**
- "各承运商的平均配送时效是几天？超时率多少？"
- "哪个仓库的利用率最高？"
- "最近3个月的发货量趋势如何？"

**知识库：**
- "仓库的温湿度控制标准是什么？"
- "承运商考核的评分标准有哪些？"

---

## Demo 3：采购供应商管理

### 准备
1. 切换到 **采购助手** Agent

### 演示对话

**供应商分析：**
- "哪些供应商的交期达成率低于85%？"
- "采购金额最高的10种物料是什么？"
- "哪些物料的库存低于安全线？"

**知识库：**
- "供应商准入标准有哪些要求？"
- "采购审批流程是怎样的？超过多少金额需要CEO审批？"

---

## Demo 4：制造业质量深度分析（Deep Research）

### 准备
1. 切换到 **制造质量官** Agent
2. 点击输入框左侧 **+** 菜单，**开启 Deep Research**

### 演示对话

**简单查询（先展示基础能力）：**
- "各产线的良品率是多少？"
- "缺陷类型中占比最高的是什么？"

**深度研究（核心演示）：**

开启 Deep Research 后输入：

> "请全面分析组装线-1（产线3）的质量问题。我需要了解：1）良品率的月度变化趋势；2）主要缺陷类型及占比；3）参考我们的质量管理体系和SPC标准，找出可能的根本原因；4）给出具体的改善建议和行动计划。"

**预期效果：**
- ArcticSwarm 多智能体协作启动
- 自动调用 Cortex Analyst 查询产线良品率趋势
- 自动调用 Cortex Analyst 查询缺陷分布
- 自动调用 Cortex Search 检索质量管理体系和SPC标准
- 生成综合研究报告（含数据图表 + 知识库引用 + 改善建议）

---

## Demo 5：创建 Semantic View（SV Builder）

### 演示步骤

1. 进入 Capabilities > **Semantic Views** 标签
2. 点击 **新建语义视图**
3. **Step 1 - 选表**：选择 COWORK > DATA > 选择 RETAIL_ORDERS、RETAIL_CUSTOMERS
4. **Step 2 - 编辑列**：查看自动推断的列类型（dimension/measure/time），可修改
5. **Step 3 - 定义关系**：添加 RETAIL_ORDERS.CUSTOMER_ID = RETAIL_CUSTOMERS.CUSTOMER_ID
6. **Step 4 - VQR**：添加验证查询
   - 问题："各区域销售额" → SQL: `SELECT REGION, SUM(TOTAL_AMOUNT) FROM COWORK.DATA.RETAIL_ORDERS GROUP BY REGION`
7. **Step 5 - 部署**：预览 YAML → 部署到 Stage

---

## Demo 6：创建 Agent + 导入 Skill

### 导入 Skill

1. 进入 Capabilities > **Skills** 标签
2. 点击 **导入 Skill (.md)**
3. 上传 `daily_report.md` 文件
4. 确认 Skill 出现在列表中

### 创建自定义 Agent

1. 进入 Capabilities > **Agents** 标签
2. 点击 **新建智能体**
3. 填写信息：
   - 名称：全能数据助手
   - 描述：跨行业综合数据分析
   - 图标：🧠
4. **数据源绑定**：
   - 勾选所有 4 个语义视图
   - 勾选 DOC_SEARCH_SERVICE
5. **Skills 绑定**：
   - 勾选 "日报生成"
6. **能力开关**：
   - ✅ Cortex Analyst
   - ✅ Cortex Search
   - ✅ 深度研究
7. 保存

### 使用 Skill

在 chat 中输入 `/daily_report`，系统会自动生成当前业务数据日报。

---

## Settings 面板说明

点击左下角头像进入 Settings，可查看：
- **显示名称** / **邮箱**
- **Organization** / **Account** / **Role** / **Warehouse**
- **主题切换**（Light / Dark）
- **语言切换**（English / 中文）

---

## 常见问题

**Q: Deep Research 没有触发？**
A: 确保在 + 菜单中开启了 Deep Research toggle，且当前 Agent 的能力开关中包含"深度研究"。

**Q: Cortex Analyst 查询失败？**
A: 检查当前 Agent 绑定的 Semantic Model 路径是否正确（@COWORK.APP.SEMANTIC_MODELS/xxx_model.yaml），以及 COWORK_WH warehouse 是否可用。

**Q: Cortex Search 没有返回结果？**
A: 检查 DOC_SEARCH_SERVICE 是否正常运行：`SHOW CORTEX SEARCH SERVICES IN DATABASE COWORK`。新创建的 Search Service 需要几分钟索引时间。
