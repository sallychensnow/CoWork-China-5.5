"""Snowflake Session Manager - handles connection for SPCS and local development."""
import os
from functools import lru_cache
from typing import Any

import snowflake.connector


def get_snowflake_connection() -> snowflake.connector.SnowflakeConnection:
    """
    Get a Snowflake connection. Supports two modes:
    1. SPCS mode: Uses OAuth token from environment (auto-injected by SPCS)
    2. Local dev mode: Uses user/password from .env
    """
    # SPCS mode - OAuth token from container
    if os.environ.get("SNOWFLAKE_HOST"):
        return snowflake.connector.connect(
            host=os.environ["SNOWFLAKE_HOST"],
            account=os.environ.get("SNOWFLAKE_ACCOUNT", ""),
            token=_get_spcs_token(),
            authenticator="oauth",
            warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "COWORK_WH"),
            database=os.environ.get("SNOWFLAKE_DATABASE", "COWORK"),
            schema=os.environ.get("SNOWFLAKE_SCHEMA", "DATA"),
        )

    # Local development mode
    return snowflake.connector.connect(
        account=os.environ.get("SNOWFLAKE_ACCOUNT", ""),
        user=os.environ.get("SNOWFLAKE_USER", ""),
        password=os.environ.get("SNOWFLAKE_PASSWORD", ""),
        warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "COWORK_WH"),
        database=os.environ.get("SNOWFLAKE_DATABASE", "COWORK"),
        schema=os.environ.get("SNOWFLAKE_SCHEMA", "DATA"),
        role=os.environ.get("SNOWFLAKE_ROLE", ""),
    )


def _get_spcs_token() -> str:
    """Read OAuth token from SPCS-injected file."""
    token_path = "/snowflake/session/token"
    if os.path.exists(token_path):
        with open(token_path) as f:
            return f.read().strip()
    return os.environ.get("SNOWFLAKE_TOKEN", "")


def execute_query(sql: str, params: dict | None = None) -> list[dict]:
    """Execute a SQL query and return results as list of dicts."""
    conn = get_snowflake_connection()
    try:
        cur = conn.cursor(snowflake.connector.DictCursor)
        cur.execute(sql, params or {})
        results = cur.fetchall()
        return [dict(row) for row in results]
    finally:
        conn.close()


async def execute_query_async(sql: str, params: dict | None = None) -> list[dict]:
    """Async wrapper for execute_query (runs in thread pool)."""
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, execute_query, sql, params)
