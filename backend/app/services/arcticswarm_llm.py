"""ArcticSwarm LLM Client configured for DashScope / DeepSeek (China region).

Builds an ArcticswarmConfig wired to Chinese LLM endpoints.
ArcticSwarm's detect_provider() sees 'qwen'/'tongyi' in model name -> VLLMChatLLMClient
which uses the OpenAI-compatible chat/completions endpoint.
"""
import os
import logging

logger = logging.getLogger(__name__)


def build_china_config(max_teammates: int = 3):
    """Build an ArcticswarmConfig pointing at DashScope Qwen or DeepSeek."""
    from arcticswarm.config import ArcticswarmConfig

    api_key = os.environ.get("DASHSCOPE_API_KEY", "")
    base_url = os.environ.get(
        "LLM_BASE_URL",
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
    )
    model = os.environ.get("LLM_MODEL", "qwen-plus")

    config = ArcticswarmConfig(
        # LLM routing: model containing 'qwen'/'tongyi' -> VLLMChatLLMClient
        openai_api_key=api_key,
        openai_base_url=base_url,
        model=model,
        api_key=api_key,
        base_url=base_url,
        # Swarm parameters
        swarm_enabled=True,
        max_teammates=max_teammates,
        max_turns=30,
        max_tokens=8192,
        # Web search disabled at config level (handled by custom ChinaWebSearchTool)
        web_search_enabled=False,
        # Snowflake connection not needed (CoWork has its own)
        sf_connection_name="",
    )
    logger.info(
        "ArcticswarmConfig built: model=%s, base_url=%s, max_teammates=%d",
        model, base_url, max_teammates,
    )
    return config
