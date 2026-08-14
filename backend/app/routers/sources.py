"""Sources router - browse Snowflake stages for semantic model YAML files."""
import os
import logging
from typing import Optional
from fastapi import APIRouter, Query

logger = logging.getLogger(__name__)
router = APIRouter()

# Active sources state
_active_sources = {
    "semantic_models": [],  # [{"name": "revenue_model.yaml", "stage": "@DB.SCHEMA.STAGE", "content": "..."}]
    "search_services": [],  # [{"name": "svc_name", "fqn": "DB.SCHEMA.SVC"}]
}


def _get_connection():
    """Get Snowflake connection - SPCS token auth or env vars."""
    import snowflake.connector

    # SPCS: use OAuth token from mounted path
    token_path = "/snowflake/session/token"
    if os.path.exists(token_path):
        with open(token_path) as f:
            token = f.read().strip()
        host = os.environ.get("SNOWFLAKE_HOST", "")
        account = os.environ.get("SNOWFLAKE_ACCOUNT", "")
        # Extract account from host if not set
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
        # Ensure warehouse is set
        conn.cursor().execute(f"USE WAREHOUSE {os.environ.get('SNOWFLAKE_WAREHOUSE', 'COWORK_WH')}")
        return conn

    # Local dev: use env vars
    return snowflake.connector.connect(
        account=os.environ.get("SNOWFLAKE_ACCOUNT", "XGFXMUS-WR98488"),
        user=os.environ.get("SNOWFLAKE_USER", "SNOW_PROD_USER"),
        password=os.environ.get("SNOWFLAKE_PASSWORD", ""),
        role=os.environ.get("SNOWFLAKE_ROLE", "SNOW_DEV_RL"),
        warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "COWORK_WH"),
        database="COWORK",
    )


@router.get("/databases")
async def list_databases():
    """List accessible databases."""
    try:
        conn = _get_connection()
        cur = conn.cursor()
        cur.execute("SHOW DATABASES")
        dbs = [row[1] for row in cur.fetchall()]
        conn.close()
        return {"databases": dbs}
    except Exception as e:
        logger.error(f"list_databases error: {e}")
        return {"databases": [], "error": str(e)}


@router.get("/schemas")
async def list_schemas(db: str = Query(...)):
    """List schemas in a database."""
    try:
        conn = _get_connection()
        cur = conn.cursor()
        cur.execute(f"SHOW SCHEMAS IN DATABASE {db}")
        schemas = [{"name": row[1], "fqn": f"{db}.{row[1]}"} for row in cur.fetchall()]
        conn.close()
        return {"schemas": schemas}
    except Exception as e:
        logger.error(f"list_schemas error: {e}")
        return {"schemas": [], "error": str(e)}


@router.get("/stages")
async def list_stages(schema: str = Query(...)):
    """List stages in a schema (pass fully-qualified like DB.SCHEMA)."""
    try:
        conn = _get_connection()
        cur = conn.cursor()
        cur.execute(f"SHOW STAGES IN {schema}")
        stages = [{"name": row[1], "fqn": f"{schema}.{row[1]}"} for row in cur.fetchall()]
        conn.close()
        return {"stages": stages}
    except Exception as e:
        logger.error(f"list_stages error: {e}")
        return {"stages": [], "error": str(e)}


@router.get("/files")
async def list_yaml_files(stage: str = Query(...)):
    """List YAML/YML files in a stage."""
    try:
        conn = _get_connection()
        cur = conn.cursor()
        cur.execute(f"LIST @{stage}")
        files = []
        for row in cur.fetchall():
            fname = row[0]  # full path like stage/filename.yaml
            if fname.endswith(('.yaml', '.yml')):
                files.append({
                    "name": fname.split("/")[-1],
                    "path": fname,
                    "size": row[1] if len(row) > 1 else 0,
                })
        conn.close()
        return {"files": files, "stage": stage}
    except Exception as e:
        logger.error(f"list_yaml_files error: {e}")
        return {"files": [], "error": str(e)}


@router.get("/load-yaml")
async def load_yaml_file(stage: str = Query(...), file: str = Query(...)):
    """Load a YAML file content from stage using a temporary file format."""
    try:
        conn = _get_connection()
        cur = conn.cursor()
        # Create temp file format then read (inline format syntax not supported in all regions)
        cur.execute("CREATE OR REPLACE TEMPORARY FILE FORMAT _COWORK_RAW_FF TYPE='CSV' FIELD_DELIMITER='NONE' RECORD_DELIMITER='\\n'")
        sql = f"SELECT $1 FROM '@{stage}/{file}' (FILE_FORMAT => '_COWORK_RAW_FF')"
        cur.execute(sql)
        rows = cur.fetchall()
        content = "\n".join([row[0] for row in rows if row[0] is not None]) if rows else ""
        conn.close()
        return {"name": file, "stage": stage, "content": content, "success": bool(content)}
    except Exception as e:
        logger.error(f"load_yaml error: {e}")
        return {"name": file, "stage": stage, "content": "", "success": False, "error": str(e)}


@router.get("/search-services")
async def list_search_services(db: str = Query("COWORK")):
    """List Cortex Search Services in a database."""
    try:
        conn = _get_connection()
        cur = conn.cursor()
        cur.execute(f"SHOW CORTEX SEARCH SERVICES IN DATABASE {db}")
        services = []
        for row in cur.fetchall():
            services.append({
                "name": row[1],
                "fqn": f"{row[2]}.{row[3]}.{row[1]}",
                "database": row[2],
                "schema": row[3],
            })
        conn.close()
        return {"services": services}
    except Exception as e:
        logger.error(f"list_search_services error: {e}")
        return {"services": [], "error": str(e)}


@router.get("/active")
async def get_active_sources():
    """Return currently active/loaded sources."""
    return _active_sources


@router.post("/activate-model")
async def activate_semantic_model(payload: dict):
    """Add a semantic model YAML to active sources."""
    name = payload.get("name", "")
    stage = payload.get("stage", "")
    content = payload.get("content", "")
    if not content:
        return {"success": False, "error": "No content"}
    # Check if already loaded
    for m in _active_sources["semantic_models"]:
        if m["name"] == name:
            m["content"] = content
            return {"success": True, "action": "updated"}
    _active_sources["semantic_models"].append({"name": name, "stage": stage, "content": content})
    return {"success": True, "action": "added"}


@router.post("/deactivate-model")
async def deactivate_semantic_model(payload: dict):
    """Remove a semantic model from active sources."""
    name = payload.get("name", "")
    _active_sources["semantic_models"] = [m for m in _active_sources["semantic_models"] if m["name"] != name]
    return {"success": True}


@router.post("/activate-search")
async def activate_search_service(payload: dict):
    """Add a search service to active tools."""
    fqn = payload.get("fqn", "")
    name = payload.get("name", "")
    if not fqn:
        return {"success": False, "error": "No fqn"}
    for s in _active_sources["search_services"]:
        if s["fqn"] == fqn:
            return {"success": True, "action": "already_active"}
    _active_sources["search_services"].append({"name": name, "fqn": fqn})
    return {"success": True, "action": "added"}


@router.post("/deactivate-search")
async def deactivate_search_service(payload: dict):
    """Remove a search service from active tools."""
    fqn = payload.get("fqn", "")
    _active_sources["search_services"] = [s for s in _active_sources["search_services"] if s["fqn"] != fqn]
    return {"success": True}
