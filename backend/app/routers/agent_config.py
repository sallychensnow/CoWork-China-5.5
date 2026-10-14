"""Agent config router - manage tools, model selection, sources, greeting."""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter()


class AgentConfig(BaseModel):
    model: str = "qwen-plus"
    provider: str = "DashScope"
    backend: str = "External API"
    deep_research: bool = False
    tools: list[str] = ["cortex_analyst", "cortex_search", "python_exec"]
    temperature: float = 0.7
    max_tokens: int = 4096


MODEL_BACKENDS = {
    "External API": {
        "id": "external",
        "description": "通过外部 API 调用云端大模型",
        "udf": "SNOWFLAKE_PROD_USER1.CORTEX_ANALYST.QWEN_COMPLETE",
    },
    "SPCS (Local)": {
        "id": "spcs_local",
        "description": "SPCS 本地部署的模型 (GPU 推理)",
        "udf": "SPCS_CHINA.MODEL_SERVICE.QWEN_COMPLETE",
    },
}
DEFAULT_BACKEND = "External API"

MODEL_PROVIDERS = {
    "DashScope": {
        "backend": "External API",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "models": [
            {"id": "qwen-plus", "name": "Qwen-Plus", "context": "128K", "description": "长上下文，性价比高，推荐默认使用"},
            {"id": "qwen-max", "name": "Qwen-Max", "context": "32K", "description": "最强推理，适合复杂分析"},
            {"id": "qwen-turbo", "name": "Qwen-Turbo", "context": "8K", "description": "极速响应，简单任务"},
        ],
    },
    "DeepSeek": {
        "backend": "External API",
        "base_url": "https://api.deepseek.com/v1",
        "models": [
            {"id": "deepseek-chat", "name": "DeepSeek-V3", "context": "64K", "description": "强代码/数学推理"},
            {"id": "deepseek-reasoner", "name": "DeepSeek-R1", "context": "64K", "description": "深度思考 CoT"},
        ],
    },
    "SPCS Qwen": {
        "backend": "SPCS (Local)",
        "base_url": None,
        "models": [
            {"id": "Qwen/Qwen2.5-1.5B-Instruct", "name": "Qwen2.5-1.5B", "context": "32K", "description": "本地部署，低延迟，数据不出境"},
            {"id": "Qwen/Qwen2.5-7B-Instruct", "name": "Qwen2.5-7B", "context": "32K", "description": "本地部署，更强推理"},
        ],
        "note": "需先部署 SPCS 模型服务 (GPU_NV_S_POOL)",
    },
}

_current_config = AgentConfig()


@router.get("/config")
async def get_config():
    return _current_config


@router.put("/config")
async def update_config(config: AgentConfig):
    global _current_config
    _current_config = config
    return _current_config


@router.get("/greeting")
async def get_greeting(request: Request):
    """Return time-aware greeting based on UTC+8 (China timezone)."""
    # Get username from SPCS auth header or fallback
    sf_user = request.headers.get("Sf-Context-Current-User", "")
    if not sf_user:
        sf_user = request.headers.get("x-snowflake-user", "User")
    # Clean up: SPCS sends uppercase login name like "YDING"
    username = sf_user.strip('"').title() if sf_user else "User"

    china_tz = timezone(timedelta(hours=8))
    now = datetime.now(china_tz)
    hour = now.hour

    if 5 <= hour < 12:
        period = "morning"
        greeting = "Good morning"
        emoji = "☀️"
    elif 12 <= hour < 18:
        period = "afternoon"
        greeting = "Good afternoon"
        emoji = "🌤️"
    elif 18 <= hour < 22:
        period = "evening"
        greeting = "Good evening"
        emoji = "🌙"
    else:
        period = "night"
        greeting = "Good night"
        emoji = "🌙"

    return {
        "greeting": greeting,
        "period": period,
        "emoji": emoji,
        "hour": hour,
        "username": username,
    }


@router.get("/models")
async def get_models():
    """Return available model backends, providers, and their models."""
    return {
        "backends": MODEL_BACKENDS,
        "providers": MODEL_PROVIDERS,
        "current_backend": _current_config.backend,
        "current_provider": _current_config.provider,
        "current_model": _current_config.model,
    }


@router.put("/model")
async def set_model(payload: dict):
    """Switch the active model, provider, and backend."""
    global _current_config
    provider = payload.get("provider", _current_config.provider)
    model_id = payload.get("model")
    backend = payload.get("backend")

    if provider not in MODEL_PROVIDERS:
        return {"success": False, "error": "Unknown provider"}

    provider_info = MODEL_PROVIDERS[provider]
    valid_ids = [m["id"] for m in provider_info["models"]]
    if model_id and model_id not in valid_ids:
        return {"success": False, "error": f"Unknown model for {provider}"}

    _current_config.provider = provider
    _current_config.backend = backend or provider_info["backend"]
    if model_id:
        _current_config.model = model_id
    else:
        _current_config.model = provider_info["models"][0]["id"]

    return {"success": True, "provider": provider, "model": _current_config.model, "backend": _current_config.backend}


@router.put("/temperature")
async def set_temperature(payload: dict):
    """Update temperature setting."""
    global _current_config
    temp = payload.get("temperature", 0.7)
    _current_config.temperature = max(0.0, min(1.0, float(temp)))
    return {"success": True, "temperature": _current_config.temperature}


@router.get("/user-info")
async def get_user_info(request: Request):
    """Return current Snowflake user identity: org, account, user, email."""
    import os
    import logging
    logger = logging.getLogger(__name__)

    # Defaults from SPCS headers
    sf_user = request.headers.get("Sf-Context-Current-User", "")
    if not sf_user:
        sf_user = request.headers.get("x-snowflake-user", "")

    result = {
        "user": sf_user.strip('"') if sf_user else "",
        "email": "",
        "account": os.environ.get("SNOWFLAKE_ACCOUNT", ""),
        "org": "",
        "role": "",
        "warehouse": "",
    }

    # Query Snowflake for full identity
    try:
        import snowflake.connector
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
                database="COWORK", schema="APP",
                warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "COWORK_WH"),
            )
        else:
            conn = snowflake.connector.connect(connection_name="kr47337")

        cur = conn.cursor()
        cur.execute("""
            SELECT
                CURRENT_USER() AS user_name,
                CURRENT_ACCOUNT_NAME() AS account_name,
                CURRENT_ORGANIZATION_NAME() AS org_name,
                CURRENT_ROLE() AS role_name,
                CURRENT_WAREHOUSE() AS warehouse_name
        """)
        row = cur.fetchone()
        if row:
            # In SPCS, CURRENT_USER() returns service owner, not the login user.
            # Only use it as fallback if no header-based user was found.
            if not result["user"]:
                result["user"] = row[0] or ""
            result["account"] = row[1] or result["account"]
            result["org"] = row[2] or ""
            result["role"] = row[3] or ""
            result["warehouse"] = row[4] or ""

        # Get email and display name via SHOW USERS
        # Use the header-based user (real login user), not CURRENT_USER() (service owner)
        try:
            user_name = result["user"]
            cur.execute(f"SHOW USERS LIKE '{user_name}'")
            row = cur.fetchone()
            if row:
                # SHOW USERS columns: name(0), created_on(1), login_name(2), display_name(3),
                # first_name(4), last_name(5), email(6), ...
                email = str(row[6]).strip() if row[6] and str(row[6]).strip().lower() != "null" else ""
                first_name = str(row[4]).strip() if row[4] and str(row[4]).strip().lower() != "null" else ""
                last_name = str(row[5]).strip() if row[5] and str(row[5]).strip().lower() != "null" else ""
                if email:
                    result["email"] = email
                # Build human-readable display name from first + last
                display_parts = [p for p in [first_name, last_name] if p]
                if display_parts:
                    result["display_name"] = " ".join(display_parts)
        except Exception as e:
            logger.debug(f"SHOW USERS failed (ok): {e}")

        conn.close()
    except Exception as e:
        logger.warning(f"user-info Snowflake query failed: {e}")

    return result
