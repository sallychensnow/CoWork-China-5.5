"""Cortex Analyst tool - Text-to-SQL via LLM UDF (China region replacement)."""
import os
import re
import time
from typing import Any

import snowflake.connector

# Cache for semantic model YAML content (TTL 10 minutes)
_yaml_cache: dict[str, tuple[str, float]] = {}
_YAML_CACHE_TTL = 600


def _get_connection():
    """Get Snowflake connection (SPCS OAuth or local dev)."""
    token_path = "/snowflake/session/token"
    if os.path.exists(token_path):
        with open(token_path) as f:
            token = f.read().strip()
        host = os.environ.get("SNOWFLAKE_HOST", "")
        account = os.environ.get("SNOWFLAKE_ACCOUNT", "")
        if not account and host:
            account = host.split(".")[0]
        conn = snowflake.connector.connect(
            account=account, host=host, authenticator="oauth", token=token,
            database=os.environ.get("SNOWFLAKE_DATABASE", "COWORK"),
            schema=os.environ.get("SNOWFLAKE_SCHEMA", "DATA"),
            warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "COWORK_WH"),
        )
        conn.cursor().execute(f"USE WAREHOUSE {os.environ.get('SNOWFLAKE_WAREHOUSE', 'COWORK_WH')}")
        return conn
    # Local dev
    return snowflake.connector.connect(connection_name='china_dev')


def _get_semantic_model_content(explicit_model: str | None) -> str | None:
    """Get semantic model YAML content from active sources or stage path."""
    try:
        from app.routers.sources import _active_sources
        models = _active_sources.get("semantic_models", [])
        if explicit_model:
            # Check if it's a stage path like @DB.SCHEMA.STAGE/file.yaml
            if explicit_model.startswith("@"):
                # Try to find in already-loaded models first
                for m in models:
                    if m.get("stage_path") == explicit_model or m.get("name") in explicit_model:
                        return m["content"]
                # Not loaded yet — fetch directly from stage
                return _fetch_yaml_from_stage(explicit_model)
            # Match by name
            for m in models:
                if m["name"] == explicit_model:
                    return m["content"]
        if models:
            return models[0]["content"]
    except Exception:
        pass
    return None


def _fetch_yaml_from_stage(stage_path: str) -> str | None:
    """Fetch YAML content directly from a Snowflake stage path (cached)."""
    # Check cache
    if stage_path in _yaml_cache:
        content, ts = _yaml_cache[stage_path]
        if time.time() - ts < _YAML_CACHE_TTL:
            return content

    import tempfile
    try:
        conn = _get_connection()
        cur = conn.cursor()
        tmp_dir = tempfile.mkdtemp()
        cur.execute(f"GET {stage_path} file://{tmp_dir}/")
        filename = stage_path.split("/")[-1]
        filepath = os.path.join(tmp_dir, filename)
        if os.path.exists(filepath):
            with open(filepath, "r") as f:
                content = f.read()
            conn.close()
            _yaml_cache[stage_path] = (content, time.time())
            return content
        conn.close()
    except Exception as e:
        import sys
        print(f"[Analyst] Failed to fetch YAML from stage: {e}", file=sys.stderr, flush=True)
    return None


def _generate_sql(conn, question: str, model_yaml: str, model: str = "qwen-plus") -> str:
    """Use Qwen UDF to generate SQL from user question + semantic model."""
    prompt = f"""Based on this semantic model:

{model_yaml}

Generate a Snowflake SQL query to answer: {question}

Rules:
- Use only tables/columns defined in the semantic model
- Return ONLY the SQL, no explanation, no markdown
- Use fully qualified table names (database.schema.table)
"""
    escaped = prompt.replace("'", "''")
    cursor = conn.cursor()
    cursor.execute(
        f"SELECT SNOWFLAKE_PROD_USER1.CORTEX_ANALYST.QWEN_COMPLETE('{model}', $${escaped}$$)"
    )
    result = cursor.fetchone()
    sql = result[0].strip() if result and result[0] else ""
    # Clean markdown code blocks if present
    if sql.startswith("```"):
        lines = sql.split("\n")
        sql = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        sql = sql.strip()
    return sql


def _build_display_hint(question: str, data: dict, sql: str) -> dict:
    """Infer best display type from data shape."""
    columns = data.get("columns", [])
    rows = data.get("rows", [])

    if len(rows) < 2 or len(columns) < 2:
        return {"type": "table", "title": question, "data": data, "sql": sql}

    def _is_numeric(val: str) -> bool:
        try:
            float(str(val).replace(",", "").replace("%", ""))
            return True
        except (ValueError, TypeError):
            return False

    def _is_date_like(val: str) -> bool:
        s = str(val).lower()
        return any(c in s for c in ['-', '/', '年', '月', 'q1', 'q2', 'q3', 'q4']) or s.isdigit() and len(s) == 4

    # Detect numeric columns (check first 3 rows)
    numeric_cols = []
    for ci in range(len(columns)):
        if all(_is_numeric(rows[ri][ci]) for ri in range(min(3, len(rows)))):
            numeric_cols.append(ci)

    def _to_float(v) -> float:
        try:
            return float(str(v).replace(",", "").replace("%", ""))
        except (ValueError, TypeError):
            return 0.0

    # Case 1: 2 columns, second is numeric → bar chart
    if len(columns) == 2 and 1 in numeric_cols:
        return {
            "type": "chart",
            "title": question,
            "data": {
                "type": "bar",
                "labels": [str(r[0]) for r in rows],
                "datasets": [{"label": columns[1], "data": [_to_float(r[1]) for r in rows]}],
            },
            "sql": sql,
        }

    # Case 2: first column is date-like, has numeric columns → line chart
    if _is_date_like(str(rows[0][0])) and numeric_cols:
        datasets = []
        for ci in numeric_cols:
            if ci == 0:
                continue
            datasets.append({"label": columns[ci], "data": [_to_float(r[ci]) for r in rows]})
        if datasets:
            return {
                "type": "chart",
                "title": question,
                "data": {
                    "type": "line",
                    "labels": [str(r[0]) for r in rows],
                    "datasets": datasets,
                },
                "sql": sql,
            }

    # Case 3: multiple numeric columns with category first col → grouped bar
    if 0 not in numeric_cols and len(numeric_cols) >= 2 and len(rows) <= 20:
        datasets = []
        for ci in numeric_cols:
            datasets.append({"label": columns[ci], "data": [_to_float(r[ci]) for r in rows]})
        return {
            "type": "chart",
            "title": question,
            "data": {
                "type": "bar",
                "labels": [str(r[0]) for r in rows],
                "datasets": datasets,
            },
            "sql": sql,
        }

    return {
        "type": "table",
        "title": question,
        "data": data,
        "sql": sql,
    }


def _query_analyst_sync(question: str, semantic_model: str | None = None, sql_model: str = "qwen-plus") -> dict:
    """Synchronous implementation of text-to-SQL. Runs in a thread to avoid blocking event loop."""
    import sys
    t0 = time.time()

    model_yaml = _get_semantic_model_content(semantic_model)
    t1 = time.time()
    print(f"[Analyst] YAML load: {t1-t0:.1f}s", file=sys.stderr, flush=True)
    if not model_yaml:
        return {"success": False, "result": "没有可用的 Semantic Model。请在 Sources 面板加载 YAML 文件。", "display": None}

    conn = _get_connection()
    try:
        # Set statement timeout to avoid exceeding SPCS 60s ingress limit
        conn.cursor().execute("ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = 30")
        t2 = time.time()
        sql = _generate_sql(conn, question, model_yaml, model=sql_model)
        t3 = time.time()
        print(f"[Analyst] SQL gen ({sql_model}): {t3-t2:.1f}s", file=sys.stderr, flush=True)
        if not sql:
            return {"success": False, "result": "LLM 无法生成 SQL", "display": None}

        cursor = conn.cursor(snowflake.connector.DictCursor)
        cursor.execute(sql)
        rows = cursor.fetchall()
        t4 = time.time()
        print(f"[Analyst] SQL exec: {t4-t3:.1f}s, total: {t4-t0:.1f}s", file=sys.stderr, flush=True)
    except Exception as e:
        return {"success": False, "result": f"SQL 执行失败: {e}\nSQL: {sql if 'sql' in dir() else 'N/A'}", "display": None}
    finally:
        conn.close()

    if not rows:
        return {"success": True, "result": f"查询无结果。\nSQL: {sql}", "display": None}

    columns = list(rows[0].keys())
    data = {"columns": columns, "rows": [[str(row.get(c, "")) for c in columns] for row in rows]}
    display = _build_display_hint(question, data, sql)

    return {"success": True, "result": f"查询返回 {len(rows)} 条结果。\nSQL: {sql}", "display": display}


async def query_analyst(question: str, semantic_model: str | None = None, sql_model: str = "qwen-plus") -> dict:
    """Text-to-SQL via LLM UDF. Runs sync DB calls in a thread to not block the event loop."""
    import asyncio
    return await asyncio.to_thread(_query_analyst_sync, question, semantic_model, sql_model)
