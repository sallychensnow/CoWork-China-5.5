"""Agents router - manage agent definitions stored in COWORK.APP.AGENTS table."""
import json
import os
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(redirect_slashes=False)

_active_agent_id: str = "customer_analyst"


def _get_conn():
    """Get Snowflake connection (SPCS token or local config)."""
    import snowflake.connector
    token_path = "/snowflake/session/token"
    if os.path.exists(token_path):
        with open(token_path) as f:
            token = f.read().strip()
        host = os.environ.get("SNOWFLAKE_HOST", "")
        account = os.environ.get("SNOWFLAKE_ACCOUNT", "")
        if not account and host:
            account = host.split(".")[0]
        return snowflake.connector.connect(
            account=account, host=host, authenticator="oauth", token=token,
            database="COWORK", schema="APP",
            warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "COWORK_WH"),
        )
    else:
        return snowflake.connector.connect(connection_name="china_dev")


class AgentDefinition(BaseModel):
    id: str
    name: str
    description: str = ""
    tools: list[str] = []
    semantic_models: list[str] = []
    search_services: list[str] = []
    system_prompt: str = ""
    icon: str = "🤖"


@router.get("/")
@router.get("")
async def list_agents():
    """List all available agents from Snowflake table."""
    try:
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute("SELECT id, name, description, semantic_models, search_services, tools, system_prompt, icon FROM COWORK.APP.AGENTS ORDER BY created_at")
        rows = cur.fetchall()
        conn.close()
        agents = []
        for r in rows:
            agents.append({
                "id": r[0],
                "name": r[1],
                "description": r[2] or "",
                "semantic_models": json.loads(r[3]) if r[3] else [],
                "search_services": json.loads(r[4]) if r[4] else [],
                "tools": json.loads(r[5]) if r[5] else [],
                "system_prompt": r[6] or "",
                "icon": r[7] or "🤖",
            })
        return {"agents": agents, "active": _active_agent_id}
    except Exception as e:
        return {"agents": [], "active": _active_agent_id, "error": str(e)}


@router.get("/{agent_id}")
async def get_agent(agent_id: str):
    """Get a specific agent definition."""
    try:
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute("SELECT id, name, description, semantic_models, search_services, tools, system_prompt, icon FROM COWORK.APP.AGENTS WHERE id = %s", (agent_id,))
        r = cur.fetchone()
        conn.close()
        if not r:
            return {"error": "Agent not found"}
        return {
            "id": r[0], "name": r[1], "description": r[2] or "",
            "semantic_models": json.loads(r[3]) if r[3] else [],
            "search_services": json.loads(r[4]) if r[4] else [],
            "tools": json.loads(r[5]) if r[5] else [],
            "system_prompt": r[6] or "", "icon": r[7] or "🤖",
        }
    except Exception as e:
        return {"error": str(e)}


@router.put("/active")
async def set_active_agent(payload: dict):
    """Set the active agent."""
    global _active_agent_id
    _active_agent_id = payload.get("agent_id", "customer_analyst")
    return {"success": True, "active": _active_agent_id}


@router.get("/active/config")
async def get_active_agent_config():
    """Get the full config for the currently active agent."""
    return await get_agent(_active_agent_id)


@router.post("/")
@router.post("")
async def create_agent(agent: AgentDefinition):
    """Create a new agent definition in Snowflake table."""
    import sys
    print(f"[AGENTS] Creating agent: id={agent.id}, name={agent.name}", file=sys.stderr, flush=True)
    try:
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO COWORK.APP.AGENTS (id, name, description, semantic_models, search_services, tools, system_prompt, icon)
               SELECT %s, %s, %s, PARSE_JSON(%s), PARSE_JSON(%s), PARSE_JSON(%s), %s, %s""",
            (agent.id, agent.name, agent.description,
             json.dumps(agent.semantic_models), json.dumps(agent.search_services),
             json.dumps(agent.tools), agent.system_prompt, agent.icon)
        )
        conn.close()
        return {"success": True, "agent": agent.model_dump()}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.put("/{agent_id}")
async def update_agent(agent_id: str, agent: AgentDefinition):
    """Update an existing agent."""
    try:
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute(
            """UPDATE COWORK.APP.AGENTS SET name=%s, description=%s,
               semantic_models=PARSE_JSON(%s), search_services=PARSE_JSON(%s),
               tools=PARSE_JSON(%s), system_prompt=%s, icon=%s WHERE id=%s""",
            (agent.name, agent.description,
             json.dumps(agent.semantic_models), json.dumps(agent.search_services),
             json.dumps(agent.tools), agent.system_prompt, agent.icon, agent_id)
        )
        conn.close()
        return {"success": True, "agent": agent.model_dump()}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str):
    """Delete an agent."""
    global _active_agent_id
    try:
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute("DELETE FROM COWORK.APP.AGENTS WHERE id = %s", (agent_id,))
        conn.close()
        if _active_agent_id == agent_id:
            _active_agent_id = "customer_analyst"
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/available-sources/list")
async def list_available_sources():
    """List available semantic models and search services for agent config."""
    sources = {"semantic_models": [], "search_services": []}
    try:
        conn = _get_conn()
        cur = conn.cursor()
        # Scan semantic model stage
        try:
            cur.execute("LS @SNOWFLAKE_PROD_USER1.DEMO_DATA.DEMO_DATA_SEMANTIC")
            for row in cur.fetchall():
                fname = row[0]
                if fname.endswith(".yaml") or fname.endswith(".yml"):
                    sources["semantic_models"].append(f"@SNOWFLAKE_PROD_USER1.DEMO_DATA.DEMO_DATA_SEMANTIC/{fname.split('/')[-1]}")
        except Exception:
            pass
        # List search services
        try:
            cur.execute("SHOW CORTEX SEARCH SERVICES IN DATABASE SNOWFLAKE_PROD_USER1")
            for row in cur.fetchall():
                sources["search_services"].append(row[1])  # name column
        except Exception:
            pass
        conn.close()
    except Exception as e:
        sources["error"] = str(e)
    return sources
