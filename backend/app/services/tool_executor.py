"""Tool Executor - dispatches tool calls and formats results with display hints."""
import json
import os
import traceback
from typing import Any


# Tool function-calling schemas (OpenAI-compatible)
TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "cortex_analyst",
            "description": "Query structured data using natural language via Snowflake Cortex Analyst. Use this when the user asks about metrics, KPIs, aggregated numbers, trends from tables.",
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {
                        "type": "string",
                        "description": "The data question in natural language, e.g. '上个月各区域销售额是多少'",
                    },
                    "semantic_model": {
                        "type": "string",
                        "description": "Optional semantic model name to query against",
                    },
                },
                "required": ["question"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "cortex_search",
            "description": "Search unstructured documents (contracts, reports, policies) using Cortex Search. Use this when the user asks about document content, policies, or needs information retrieval.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query for document retrieval",
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Number of results to return (default 5)",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "python_exec",
            "description": "Execute Python code for data analysis, computation, or generating visualizations. Use when user needs calculations, data transformations, or chart generation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "Python code to execute",
                    },
                    "description": {
                        "type": "string",
                        "description": "Brief description of what this code does",
                    },
                },
                "required": ["code"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "deep_research",
            "description": "Launch a multi-agent deep research investigation via ArcticSwarm. Use only for complex questions requiring extensive web research or multi-source synthesis.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The research question to investigate",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the internet for real-time information. Use when the user asks about current events, recent news, latest data, or anything that requires up-to-date web information.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to look up on the web",
                    },
                },
                "required": ["query"],
            },
        },
    },
]


def get_tool_schemas(enabled_tools: list[str] | None = None) -> list[dict]:
    """Return tool schemas filtered by enabled tools list."""
    if enabled_tools is None:
        return TOOL_SCHEMAS
    return [t for t in TOOL_SCHEMAS if t["function"]["name"] in enabled_tools]


async def execute_tool(name: str, arguments: dict, agent_config: dict | None = None) -> dict:
    """
    Execute a tool and return a structured result.
    agent_config: active agent's config (semantic_models, search_services, etc.)
    """
    try:
        if name == "cortex_analyst":
            return await _exec_cortex_analyst(arguments, agent_config)
        elif name == "cortex_search":
            return await _exec_cortex_search(arguments, agent_config)
        elif name == "python_exec":
            return await _exec_python(arguments)
        elif name == "deep_research":
            return await _exec_deep_research(arguments, agent_config)
        elif name == "web_search":
            return await _exec_web_search(arguments)
        else:
            return {"success": False, "result": f"Unknown tool: {name}", "display": None}
    except Exception as e:
        return {
            "success": False,
            "result": f"Tool execution error: {str(e)}\n{traceback.format_exc()}",
            "display": None,
        }


async def _exec_cortex_analyst(args: dict, agent_config: dict | None = None) -> dict:
    """Execute Cortex Analyst query using agent's configured semantic models."""
    question = args["question"]
    # Determine semantic model from agent config or explicit argument
    semantic_model = args.get("semantic_model")
    if not semantic_model and agent_config and agent_config.get("semantic_models"):
        semantic_model = agent_config["semantic_models"][0]  # use first configured model
    # SQL generation model: from agent config or default
    sql_model = (agent_config or {}).get("sql_model", "qwen-plus")
    try:
        from app.services.tools.cortex_analyst import query_analyst
        result = await query_analyst(question, semantic_model, sql_model=sql_model)
        return result
    except Exception as e:
        import traceback
        return {
            "success": False,
            "result": f"Cortex Analyst 调用失败: {str(e)}\n{traceback.format_exc()}",
            "display": None,
        }


async def _exec_cortex_search(args: dict, agent_config: dict | None = None) -> dict:
    """Execute Cortex Search query using agent's configured search services."""
    query = args["query"]
    top_k = args.get("top_k", 5)
    # Use agent's configured search service
    service_name = None
    if agent_config and agent_config.get("search_services"):
        service_name = agent_config["search_services"][0]
    try:
        from app.services.tools.cortex_search import search_documents
        result = await search_documents(query, top_k, service_name=service_name)
        return result
    except Exception as e:
        import traceback
        return {
            "success": False,
            "result": f"Cortex Search 调用失败: {str(e)}\n{traceback.format_exc()}",
            "display": None,
        }


async def _exec_python(args: dict) -> dict:
    """Execute Python code in a sandboxed environment."""
    code = args["code"]
    description = args.get("description", "")
    # TODO: implement proper sandboxed execution (RestrictedPython or subprocess)
    # For now, return code as display
    return {
        "success": True,
        "result": f"[Python] {description}\n代码已准备执行:\n```python\n{code}\n```",
        "display": {
            "type": "code",
            "title": description or "Python 执行",
            "data": {"language": "python", "code": code},
        },
    }


async def _exec_deep_research(args: dict, agent_config: dict | None = None, on_progress=None) -> dict:
    """Launch deep research — multi-agent research enriched with internal data."""
    query = args["query"]
    import sys
    import asyncio
    print(f"[RESEARCH] Starting deep research for: {query[:60]}", file=sys.stderr, flush=True)
    try:
        # Step 1: Gather internal data (with timeout, in executor to avoid blocking)
        internal_context_parts = []

        async def _fetch_analyst():
            try:
                from app.services.tools.cortex_analyst import query_analyst
                # Use agent's configured semantic model
                sem_model = None
                if agent_config and agent_config.get("semantic_models"):
                    sem_model = agent_config["semantic_models"][0]
                result = await asyncio.wait_for(query_analyst(query, sem_model), timeout=15)
                if result.get("success") and result.get("result"):
                    return f"【内部数据（Cortex Analyst）】:\n{result['result'][:2000]}"
            except Exception as e:
                print(f"[RESEARCH] Analyst fetch failed (ok): {e}", file=sys.stderr, flush=True)
            return None

        async def _fetch_search():
            try:
                from app.services.tools.cortex_search import search_documents
                # Use agent's configured search service
                svc_name = None
                if agent_config and agent_config.get("search_services"):
                    svc_name = agent_config["search_services"][0]
                result = await asyncio.wait_for(search_documents(query, top_k=3, service_name=svc_name), timeout=15)
                if result.get("success") and result.get("result"):
                    return f"【内部知识库（Cortex Search）】:\n{result['result'][:2000]}"
            except Exception as e:
                print(f"[RESEARCH] Search fetch failed (ok): {e}", file=sys.stderr, flush=True)
            return None

        # Run both in parallel with 15s timeout each
        analyst_task = asyncio.create_task(_fetch_analyst())
        search_task = asyncio.create_task(_fetch_search())
        results = await asyncio.gather(analyst_task, search_task, return_exceptions=True)
        for r in results:
            if isinstance(r, str):
                internal_context_parts.append(r)

        # Step 2: Build enriched query
        if internal_context_parts:
            enriched_query = (
                f"{query}\n\n"
                f"## 以下是来自内部系统的参考数据\n" + "\n\n".join(internal_context_parts) +
                f"\n\n请结合以上内部数据和网络信息进行深入分析。"
            )
            print(f"[RESEARCH] Enriched with {len(internal_context_parts)} internal sources", file=sys.stderr, flush=True)
        else:
            enriched_query = query
            print("[RESEARCH] No internal data available, using raw query", file=sys.stderr, flush=True)

        # Step 3: Run multi-agent research (ArcticSwarm or fallback)
        use_arcticswarm = os.environ.get("USE_ARCTICSWARM", "true").lower() == "true"

        if use_arcticswarm:
            print("[RESEARCH] Using ArcticSwarm engine", file=sys.stderr, flush=True)
            from app.services.swarm_bridge import run_arcticswarm_research
            enable_web = "web_search" in ((agent_config or {}).get("tools") or [])
            result = await run_arcticswarm_research(
                query=enriched_query,
                max_teammates=3,
                timeout_seconds=280,
                on_progress=on_progress,
                agent_config=agent_config,
                enable_web_search=enable_web,
            )
        else:
            print("[RESEARCH] Using simple deep_research engine (fallback)", file=sys.stderr, flush=True)
            from app.services.deep_research import run_deep_research
            result = await run_deep_research(enriched_query, on_progress=on_progress)

        print(f"[RESEARCH] Result status: {result.get('status')}", file=sys.stderr, flush=True)
        status = result.get("status")
        if status == "completed":
            return {
                "success": True,
                "result": result.get("report", "（无内容）"),
                "display": None,
            }
        else:
            return {
                "success": False,
                "result": result.get("message", "Research failed"),
                "display": None,
            }
    except Exception as e:
        import traceback
        print(f"[RESEARCH] Exception: {e}\n{traceback.format_exc()}", file=sys.stderr, flush=True)
        return {"success": False, "result": f"Deep Research error: {str(e)}", "display": None}


async def _exec_web_search(args: dict) -> dict:
    """Web search via DashScope's Qwen model with built-in search capability."""
    import os
    import httpx

    query = args["query"]
    api_key = os.environ.get("DASHSCOPE_API_KEY", "")
    if not api_key:
        return {"success": False, "result": "DASHSCOPE_API_KEY not set", "display": None}

    try:
        url = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {
            "model": "qwen-plus",
            "messages": [
                {"role": "system", "content": "你是一个联网搜索助手。请搜索最新信息并以结构化方式返回搜索结果摘要。每个结果包含标题、摘要和来源。"},
                {"role": "user", "content": query},
            ],
            "enable_search": True,
            "max_tokens": 2000,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        content = data["choices"][0]["message"]["content"]
        # Extract search references if available
        search_results = data.get("choices", [{}])[0].get("message", {}).get("search_results", [])

        display_items = []
        if search_results:
            for sr in search_results[:5]:
                display_items.append({
                    "title": sr.get("title", ""),
                    "content": sr.get("content", sr.get("snippet", "")),
                    "url": sr.get("url", sr.get("link", "")),
                })

        return {
            "success": True,
            "result": content,
            "display": {
                "type": "search_results",
                "title": f"搜索: {query}",
                "data": {"results": display_items} if display_items else None,
            } if display_items else None,
        }
    except Exception as e:
        return {
            "success": False,
            "result": f"Web search failed: {str(e)}",
            "display": None,
        }
