"""Agent config router - manage tools, model selection, sources, greeting."""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter()


class AgentConfig(BaseModel):
    model: str = "qwen3-235b-a22b"
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
        "base_url": "https://llm-epvjbnzw1zc7ogds.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
        "models": [
            {"id": "qwen3-235b-a22b", "name": "Qwen-Max", "context": "32K", "description": "最强推理，适合复杂分析"},
            {"id": "qwen-plus", "name": "Qwen-Plus", "context": "128K", "description": "长上下文，性价比高"},
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
