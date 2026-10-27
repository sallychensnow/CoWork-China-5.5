"""Cortex Search tool - search unstructured documents via SNOWFLAKE.CORTEX.SEARCH_PREVIEW SQL function."""
import json
import logging
import os

import snowflake.connector

logger = logging.getLogger(__name__)


def _get_connection():
    """Get Snowflake connection - SPCS token auth or local dev."""
    token_path = "/snowflake/session/token"
    if os.path.exists(token_path):
        with open(token_path) as f:
            token = f.read().strip()
        host = os.environ.get("SNOWFLAKE_HOST", "")
        account = os.environ.get("SNOWFLAKE_ACCOUNT", "")
        if not account and host:
            account = host.split(".")[0]
        conn = snowflake.connector.connect(
            account=account,
            host=host,
            authenticator="oauth",
            token=token,
            database=os.environ.get("SNOWFLAKE_DATABASE", "COWORK"),
            schema=os.environ.get("SNOWFLAKE_SCHEMA", "DATA"),
            warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "COWORK_WH"),
        )
        conn.cursor().execute(f"USE WAREHOUSE {os.environ.get('SNOWFLAKE_WAREHOUSE', 'COWORK_WH')}")
        return conn
    # Local dev: use connection name
    return snowflake.connector.connect(connection_name=os.environ.get("SNOWFLAKE_CONNECTION_NAME", "default"))


def _get_active_search_service():
    """Get the first active search service FQN from sources config."""
    from app.routers.sources import _active_sources

    search_services = _active_sources.get("search_services", [])
    if search_services:
        return search_services[0]["fqn"]
    return None


def _get_service_columns(service_fqn: str) -> list[str]:
    """Get attribute columns for a search service by querying SHOW CORTEX SEARCH SERVICES.

    Falls back to a safe default when the metadata query fails.
    """
    try:
        conn = _get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SHOW CORTEX SEARCH SERVICES IN ACCOUNT")
            rows = cur.fetchall()
            desc = [d[0].upper() for d in cur.description]
            name_idx = desc.index("NAME") if "NAME" in desc else None
            db_idx = desc.index("DATABASE_NAME") if "DATABASE_NAME" in desc else None
            schema_idx = desc.index("SCHEMA_NAME") if "SCHEMA_NAME" in desc else None
            cols_idx = desc.index("COLUMNS") if "COLUMNS" in desc else None
            search_col_idx = desc.index("SEARCH_COLUMN") if "SEARCH_COLUMN" in desc else None
            if name_idx is not None and cols_idx is not None:
                for row in rows:
                    fqn = f"{row[db_idx]}.{row[schema_idx]}.{row[name_idx]}" if db_idx is not None and schema_idx is not None else row[name_idx]
                    if fqn == service_fqn or service_fqn.endswith(row[name_idx]):
                        all_cols = [c.strip() for c in row[cols_idx].split(",") if c.strip()]
                        search_col = row[search_col_idx] if search_col_idx is not None else None
                        # Return all columns except the search column (it's included automatically)
                        return [c for c in all_cols if c != search_col] or all_cols
        finally:
            conn.close()
    except Exception as e:
        logger.warning(f"Failed to auto-detect columns for {service_fqn}: {e}")
    # Safe fallback — no SOURCE (not all services have it)
    return ["CONTENT", "TITLE", "CATEGORY"]


_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "manufacturing": {
        "keywords": ["产线", "产量", "良品", "良率", "工单", "质检", "缺陷", "质量", "生产", "班次",
                      "OEE", "SPC", "组装", "焊接", "AOI", "8D", "不良", "返工", "过程能力",
                      "控制图", "Cpk", "IQC", "IPQC", "FQC", "OQC", "FAI", "MES"],
        "categories": ["质量体系", "质量标准", "SPC标准", "MES系统", "可靠性测试", "换型规范",
                        "生产计划", "精益生产", "设备维护", "自动化规划", "工业物联网"],
    },
    "logistics": {
        "keywords": ["物流", "运输", "仓库", "库存", "发货", "承运", "车辆", "运单", "配送", "冷链"],
        "categories": ["仓储管理", "异常处理", "时效标准", "冷链规范", "考核标准", "智能仓储",
                        "3PL选择", "跨境物流", "大促保障", "成本控制"],
    },
    "procurement": {
        "keywords": ["采购", "供应商", "物料", "采购订单", "采购价", "供应链", "到货", "交期", "合同"],
        "categories": ["准入标准", "审批流程", "验收标准", "合同管理", "供应商审计", "库存策略",
                        "战略采购", "价格波动", "风险管理", "绿色供应链"],
    },
    "retail": {
        "keywords": ["零售", "销售", "客户", "订单", "电商", "商品", "退货", "促销", "门店", "会员"],
        "categories": ["退货政策", "会员规则", "促销规则", "服务规范", "运营指标", "数据安全",
                        "全渠道策略", "客户画像", "数字化转型"],
    },
}


def _detect_category_filter(query: str) -> dict | None:
    """Detect domain from query keywords and return a Cortex Search filter for CATEGORY."""
    q_lower = query.lower()
    best_domain, best_score = None, 0
    for domain, info in _CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in info["keywords"] if kw.lower() in q_lower)
        if score > best_score:
            best_score = score
            best_domain = domain
    if best_domain and best_score >= 1:
        cats = _CATEGORY_KEYWORDS[best_domain]["categories"]
        if len(cats) == 1:
            return {"@eq": {"CATEGORY": cats[0]}}
        return {"@or": [{"@eq": {"CATEGORY": c}} for c in cats]}
    return None


def _search_documents_sync(query: str, top_k: int = 5, service_name: str | None = None) -> dict:
    """Synchronous Cortex Search query. Runs in a thread to avoid blocking event loop."""
    if service_name:
        service_fqn = service_name
        if "." not in service_fqn:
            from app.routers.sources import _active_sources
            for svc in _active_sources.get("search_services", []):
                if svc.get("name") == service_name or svc.get("fqn", "").endswith(service_name):
                    service_fqn = svc["fqn"]
                    break
    else:
        service_fqn = _get_active_search_service()
    if not service_fqn:
        return {"success": False, "result": "没有激活的 Cortex Search 服务。请在 Sources 面板中激活一个搜索服务。", "display": None}

    columns = _get_service_columns(service_fqn)

    payload = {
        "query": query.strip(),
        "columns": columns,
        "limit": min(top_k, 20),
    }
    # Auto-detect domain and add category filter
    cat_filter = _detect_category_filter(query)
    if cat_filter:
        payload["filter"] = cat_filter
        logger.info("Auto-filter cortex_search by domain: %s", cat_filter)
    payload_str = json.dumps(payload, ensure_ascii=False).replace("'", "''")
    sql = f"SELECT SNOWFLAKE.CORTEX.SEARCH_PREVIEW('{service_fqn}', '{payload_str}')"

    conn = None
    try:
        conn = _get_connection()
        cursor = conn.cursor()
        cursor.execute(sql)
        row = cursor.fetchone()
    except Exception as e:
        logger.error(f"Cortex Search query failed: {e}")
        return {"success": False, "result": f"Cortex Search 查询失败: {e}", "display": None}
    finally:
        if conn:
            conn.close()

    if not row or not row[0]:
        return {"success": True, "result": f"搜索 \"{query}\" 未找到相关内容。", "display": None}

    parsed = json.loads(row[0])
    items = parsed.get("results", [])

    if not items:
        return {"success": True, "result": f"搜索 \"{query}\" 未找到相关内容。", "display": None}

    # Format text summary for LLM context
    text_parts = [f"搜索 \"{query}\" 找到 {len(items)} 条结果:\n"]
    for i, item in enumerate(items, 1):
        # Build a generic summary line from available fields
        parts = []
        if "PRODUCT_NAME" in item:
            parts.append(f"[{item['PRODUCT_NAME']}]")
        elif "TITLE" in item:
            parts.append(f"[{item['TITLE']}]")
        elif "title" in item:
            parts.append(f"[{item['title']}]")
        if "RATING" in item:
            parts.append(f"评分{item['RATING']}")
        if "CATEGORY" in item:
            parts.append(f"({item['CATEGORY']})")

        content = item.get("REVIEW_TEXT", item.get("CONTENT", item.get("chunk", "")))
        text_parts.append(f"{i}. {' '.join(parts)}: {content[:200]}")

    display = {
        "type": "search_results",
        "title": f"搜索: {query}",
        "data": {"results": items},
    }

    return {"success": True, "result": "\n".join(text_parts), "display": display}


async def search_documents(query: str, top_k: int = 5, service_name: str | None = None) -> dict:
    """Async wrapper — runs sync DB calls in a thread to not block the event loop."""
    import asyncio
    return await asyncio.to_thread(_search_documents_sync, query, top_k, service_name)
