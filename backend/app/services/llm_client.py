"""LLM Client - unified interface for DashScope (Qwen), DeepSeek with function-calling support."""
import json
import os
import logging
from typing import AsyncGenerator

import httpx

logger = logging.getLogger(__name__)

# China-region LLM endpoints (keyed by model id)
LLM_CONFIGS = {
    "qwen3-235b-a22b": {
        "base_url": "https://llm-epvjbnzw1zc7ogds.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
        "model": "qwen3-235b-a22b",
        "env_key": "DASHSCOPE_API_KEY",
    },
    "qwen-plus": {
        "base_url": "https://llm-epvjbnzw1zc7ogds.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-plus",
        "env_key": "DASHSCOPE_API_KEY",
    },
    "qwen-turbo": {
        "base_url": "https://llm-epvjbnzw1zc7ogds.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-turbo",
        "env_key": "DASHSCOPE_API_KEY",
    },
    "deepseek-chat": {
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
        "env_key": "DEEPSEEK_API_KEY",
    },
    "deepseek-reasoner": {
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-reasoner",
        "env_key": "DEEPSEEK_API_KEY",
    },
}


async def call_llm_stream(
    messages: list[dict],
    model: str = "qwen3-235b-a22b",
    tools: list[dict] | None = None,
    temperature: float = 0.7,
) -> AsyncGenerator[str, None]:
    """Stream LLM response. Yields JSON strings: {"content": "..."} or {"tool_calls": [...]}."""
    config = LLM_CONFIGS.get(model, LLM_CONFIGS["qwen3-235b-a22b"])
    api_key = os.environ.get(config["env_key"], "")

    url = f"{config['base_url']}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": config["model"],
        "messages": messages,
        "stream": True,
        "temperature": temperature,
        "enable_thinking": False,  # Disable Qwen3 thinking for tool-calling compatibility
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    # Accumulate tool_calls across streamed chunks
    accumulated_tool_calls: dict[int, dict] = {}

    async with httpx.AsyncClient(timeout=120.0) as client:
        logger.info(f"Calling LLM: model={config['model']}, url={url}, tools={bool(tools)}")
        async with client.stream("POST", url, json=payload, headers=headers) as resp:
            logger.info(f"LLM response status: {resp.status_code}")
            if resp.status_code != 200:
                error_body = await resp.aread()
                logger.error(f"LLM API error {resp.status_code}: {error_body[:500]}")
                yield json.dumps({"content": f"[LLM Error: {resp.status_code}]"})
                return
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    delta = chunk["choices"][0].get("delta", {})

                    # Content streaming
                    content = delta.get("content", "")
                    if content:
                        yield json.dumps({"content": content})

                    # Tool calls accumulation
                    if "tool_calls" in delta:
                        for tc in delta["tool_calls"]:
                            idx = tc["index"]
                            if idx not in accumulated_tool_calls:
                                accumulated_tool_calls[idx] = {
                                    "id": tc.get("id", ""),
                                    "type": "function",
                                    "function": {"name": "", "arguments": ""},
                                }
                            entry = accumulated_tool_calls[idx]
                            if tc.get("id"):
                                entry["id"] = tc["id"]
                            fn = tc.get("function", {})
                            if fn.get("name"):
                                entry["function"]["name"] = fn["name"]
                            if fn.get("arguments"):
                                entry["function"]["arguments"] += fn["arguments"]

                except (json.JSONDecodeError, KeyError, IndexError):
                    continue

    # After stream ends, if we accumulated tool_calls, yield them
    if accumulated_tool_calls:
        tool_calls = [accumulated_tool_calls[i] for i in sorted(accumulated_tool_calls)]
        logger.info(f"Tool calls accumulated: {json.dumps(tool_calls, ensure_ascii=False)[:300]}")
        yield json.dumps({"tool_calls": tool_calls})


async def call_llm_sync(
    messages: list[dict],
    model: str = "qwen3-235b-a22b",
    tools: list[dict] | None = None,
    temperature: float = 0.7,
) -> dict:
    """Non-streaming LLM call. Returns the full response message dict."""
    config = LLM_CONFIGS.get(model, LLM_CONFIGS["qwen3-235b-a22b"])
    api_key = os.environ.get(config["env_key"], "")

    url = f"{config['base_url']}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": config["model"],
        "messages": messages,
        "temperature": temperature,
        "enable_thinking": False,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    async with httpx.AsyncClient(timeout=120.0) as client:
        logger.info(f"Sync LLM call: model={config['model']}")
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]
