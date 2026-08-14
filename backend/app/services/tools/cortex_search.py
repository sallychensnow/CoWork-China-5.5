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
    return snowflake.connector.connect(connection_name="china_dev")


def _get_active_search_service():
    """Get the first active search service FQN from sources config."""
    from app.routers.sources import _active_sources

    search_services = _active_sources.get("search_services", [])
    if search_services:
        return search_services[0]["fqn"]
    return None


def _get_service_columns(service_fqn: str) -> list[str]:
    """Get columns to retrieve for a given search service.
    
    Returns a reasonable default set of columns. The search column itself
    is always included in results by SEARCH_PREVIEW.
    """
    # Known service column mappings
    known_services = {
        "SNOWFLAKE_PROD_USER1.DEMO_DATA.PRODUCT_REVIEWS_CN_SEARCH": [
            "REVIEW_TEXT", "PRODUCT_NAME", "CATEGORY", "RATING", "PROVINCE"
        ],
        "SNOWFLAKE_PROD_USER1.CORTEX_SEARCH_RAG_DEMO.KNOWLEDGE_BASE_SEARCH": [
            "CONTENT", "TITLE", "CATEGORY", "SOURCE"
        ],
    }
    # Generic fallback: try common column names
    return known_services.get(service_fqn, ["CONTENT", "TITLE", "SOURCE"])


def _search_documents_sync(query: str, top_k: int = 5, service_name: str | None = None) -> dict:
    """Synchronous Cortex Search query. Runs in a thread to avoid blocking event loop."""
    if service_name:
        # Use explicitly provided service name (from agent config)
        service_fqn = service_name
        # Try to resolve to FQN if it's just a short name
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
