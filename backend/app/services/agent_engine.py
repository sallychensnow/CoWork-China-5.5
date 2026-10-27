"""Agent Engine - orchestrates ReAct loop with LLM function-calling and tool execution."""
import asyncio
import json
import logging
import time
from typing import AsyncGenerator

from app.routers.chat import ChatRequest
from app.services.skills_engine import SkillsEngine
from app.services.llm_client import call_llm_stream, call_llm_sync
from app.services.tool_executor import execute_tool, get_tool_schemas

logger = logging.getLogger(__name__)
skills_engine = SkillsEngine()

MAX_TOOL_ROUNDS = 8

# In-memory cache for agent configs (TTL 5 minutes)
_agent_cache: dict[str, tuple[dict, float]] = {}
_CACHE_TTL = 300  # seconds


def _load_active_agent_sync(agent_id: str) -> dict | None:
    """Synchronous helper to load agent from Snowflake table (with in-memory cache)."""
    # Check cache first
    if agent_id in _agent_cache:
        cached, ts = _agent_cache[agent_id]
        if time.time() - ts < _CACHE_TTL:
            logger.info(f"Agent config cache hit: {agent_id}")
            return cached

    try:
        from app.routers.agents import _get_conn
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, description, semantic_models, search_services, tools, system_prompt, icon "
            "FROM COWORK.APP.AGENTS WHERE id = %s", (agent_id,))
        r = cur.fetchone()
        conn.close()
        if r:
            result = {
                "id": r[0], "name": r[1], "description": r[2] or "",
                "semantic_models": json.loads(r[3]) if r[3] else [],
                "search_services": json.loads(r[4]) if r[4] else [],
                "tools": json.loads(r[5]) if r[5] else [],
                "system_prompt": r[6] or "", "icon": r[7] or "🤖",
            }
            _agent_cache[agent_id] = (result, time.time())
            return result
    except Exception as e:
        logger.warning(f"Failed to load agent config: {e}")
    return None


async def _load_active_agent(request: ChatRequest) -> dict | None:
    """Load agent config in a thread to avoid blocking the event loop."""
    import asyncio
    from app.routers.agents import _active_agent_id
    agent_id = request.agent_id or _active_agent_id
    return await asyncio.to_thread(_load_active_agent_sync, agent_id)


async def _stream_with_heartbeat(stream: AsyncGenerator, interval: float = 5.0):
    """Wrap an async generator with periodic heartbeat yields (None) when idle.
    This keeps the SSE connection alive during slow LLM inference."""
    import asyncio

    aiter = stream.__aiter__()
    while True:
        try:
            item = await asyncio.wait_for(aiter.__anext__(), timeout=interval)
            yield item
        except asyncio.TimeoutError:
            yield None  # heartbeat signal
        except StopAsyncIteration:
            break


async def run_agent(request: ChatRequest) -> AsyncGenerator[str, None]:
    """
    Main agent loop implementing ReAct pattern:
    1. Send messages + tool schemas to LLM
    2. If LLM returns tool_calls -> execute tools, append results, loop
    3. If LLM returns content -> stream to frontend
    """
    # Load active agent config (runs sync DB call in thread)
    agent_config = await _load_active_agent(request)

    system_prompt = _build_system_prompt(request, agent_config)
    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    messages += [m.model_dump() for m in request.messages]

    yield json.dumps({"type": "thinking", "text": "正在思考...", "call_id": "init"})

    # ── Deep Research shortcut: emit async event so frontend polls /api/research/* ──
    if request.deep_research:
        user_query = request.messages[-1].content if request.messages else ""
        yield json.dumps({"type": "thinking", "text": "启动深度研究流程...", "call_id": "dr_start"})
        yield json.dumps({
            "type": "deep_research_async",
            "query": user_query,
        })
        return

    # Determine which tools are available
    enabled_tools = _get_enabled_tools(request, agent_config)
    tool_schemas = get_tool_schemas(enabled_tools, agent_config=agent_config) if enabled_tools else None

    for round_num in range(MAX_TOOL_ROUNDS):
        content_buffer = ""
        tool_calls = None
        got_first_token = False

        logger.info(f"Agent round {round_num + 1}, tools enabled: {enabled_tools}")

        # Stream LLM with heartbeat: send keepalive while waiting for first token
        llm_stream = call_llm_stream(messages, model=request.model, tools=tool_schemas)
        heartbeat_secs = 0

        async for chunk_str in _stream_with_heartbeat(llm_stream, interval=5.0):
            if chunk_str is None:
                # Heartbeat tick — send progress to keep SSE alive
                heartbeat_secs += 5
                if not got_first_token:
                    yield json.dumps({
                        "type": "thinking",
                        "text": f"模型推理中... ({heartbeat_secs}s)",
                        "call_id": f"llm_r{round_num}",
                    })
                continue

            chunk = json.loads(chunk_str)

            if "content" in chunk:
                if not got_first_token:
                    got_first_token = True
                content_buffer += chunk["content"]
                yield json.dumps({"type": "content", "content": chunk["content"]})

            if "tool_calls" in chunk:
                tool_calls = chunk["tool_calls"]

        if not tool_calls:
            logger.info(f"Round {round_num + 1}: No tool calls, content length={len(content_buffer)}")
            break

        logger.info(f"Round {round_num + 1}: Got {len(tool_calls)} tool call(s)")
        assistant_msg: dict = {"role": "assistant", "content": content_buffer or None}
        assistant_msg["tool_calls"] = tool_calls
        messages.append(assistant_msg)

        for tc in tool_calls:
            fn_name = tc["function"]["name"]
            try:
                fn_args = json.loads(tc["function"]["arguments"])
            except json.JSONDecodeError:
                fn_args = {}

            # Notify frontend about tool execution (thinking + tool_start)
            yield json.dumps({
                "type": "thinking",
                "text": f"正在调用 {fn_name}...",
                "call_id": tc["id"],
            })
            yield json.dumps({
                "type": "tool_start",
                "tool": fn_name,
                "arguments": fn_args,
                "call_id": tc["id"],
            })

            if fn_name == "deep_research":
                yield json.dumps({
                    "type": "deep_research_async",
                    "query": fn_args.get("query", ""),
                    "call_id": tc["id"],
                })
                yield json.dumps({"type": "done"})
                return
            else:
                # Execute tool with heartbeat to keep SSE connection alive
                # Hard cap at 45s to stay under SPCS 60s ingress timeout
                tool_task = asyncio.create_task(
                    execute_tool(fn_name, fn_args, agent_config=agent_config)
                )
                heartbeat_count = 0
                tool_timeout = False
                while not tool_task.done():
                    try:
                        await asyncio.wait_for(asyncio.shield(tool_task), timeout=5.0)
                    except asyncio.TimeoutError:
                        heartbeat_count += 1
                        elapsed = heartbeat_count * 5
                        yield json.dumps({
                            "type": "thinking",
                            "text": f"正在执行 {fn_name}... ({elapsed}s)",
                            "call_id": tc["id"],
                        })
                        if elapsed >= 45:
                            tool_task.cancel()
                            tool_timeout = True
                            break

                if tool_timeout:
                    result = {"success": False, "result": f"工具 {fn_name} 执行超时（>45s），请稍后重试", "display": None}
                else:
                    result = tool_task.result()

            yield json.dumps({
                "type": "tool_result",
                "tool": fn_name,
                "call_id": tc["id"],
                "success": result["success"],
                "display": result.get("display"),
            })

            messages.append({
                "role": "tool",
                "tool_call_id": tc["id"],
                "content": result["result"],
            })

    yield json.dumps({"type": "done"})


def _get_enabled_tools(request: ChatRequest, agent_config: dict | None = None) -> list[str] | None:
    """Determine which tools to make available based on agent config.
    
    deep_research is only enabled when the user explicitly toggles it in PlusMenu
    (request.deep_research == True), regardless of agent config.
    """
    if agent_config and agent_config.get("tools"):
        tools = [t for t in agent_config["tools"] if t != "deep_research"]
    else:
        tools = ["cortex_analyst", "cortex_search", "python_exec"]
    # Only add deep_research when user explicitly enabled it in PlusMenu
    if request.deep_research:
        tools.append("deep_research")
    return tools


def _build_system_prompt(request: ChatRequest, agent_config: dict | None = None) -> str:
    from datetime import datetime, timezone, timedelta
    china_tz = timezone(timedelta(hours=8))
    now = datetime.now(china_tz)
    date_str = now.strftime("%Y年%m月%d日 %H:%M")

    parts = [
        f"你是 CoWork China 智能助手。当前时间: {date_str} (北京时间)。当前年份是{now.year}年，请勿提及过去的年份除非用户明确要求。",
    ]

    # Inject agent-specific system prompt
    if agent_config and agent_config.get("system_prompt"):
        parts.append("")
        parts.append(f"## 角色定义")
        parts.append(agent_config["system_prompt"])

    # Inject data source context
    if agent_config:
        if agent_config.get("semantic_models"):
            models = ", ".join(agent_config["semantic_models"])
            parts.append(f"\n## 数据源")
            parts.append(f"- 语义模型: {models}")
        if agent_config.get("search_services"):
            services = ", ".join(agent_config["search_services"])
            parts.append(f"- 搜索服务: {services}")

    parts.extend([
        "",
        "## 核心规则（必须遵守）",
        "1. 当用户询问任何数据、数字、指标、统计、排名、趋势、对比时 → 必须调用 cortex_analyst",
        "2. 当用户询问文档、报告、政策、合同、搜索内容时 → 必须调用 cortex_search",
        "3. 当用户要求计算、画图、编程时 → 必须调用 python_exec",
        "4. 绝对不要自己编造数据或假装知道企业内部数据",
        "5. 只有纯闲聊（如'你好'、'你是谁'）才不调用工具",
        "",
        "## 工具说明",
        "- cortex_analyst: 查询结构化数据（销售额、库存、订单、客户、KPI等）",
        "- cortex_search: 检索非结构化文档（合同、政策、报告、会议纪要）",
        "- python_exec: 执行Python代码（数学计算、图表生成、数据变换）",
        "",
        "## 回复格式",
        "- 使用Markdown格式",
        "- 先给关键结论，再展示详情",
        "- 如果工具返回了数据，基于工具结果回答，不要重新编造",
    ])

    if request.deep_research or (agent_config and "deep_research" in (agent_config.get("tools") or [])):
        parts.append("")
        parts.append("## 深度研究模式已激活")
        parts.append("- deep_research: 多智能体协作深度调研，用于复杂开放性问题")
        parts.append("- 当问题需要综合多源信息或深度分析时，优先使用 deep_research")

    # Skill injection: only inject into system prompt if skill_trigger is explicitly passed
    # (Frontend now sends full prompt as user message content, so auto-match is unnecessary)
    import sys
    if request.skill_trigger:
        print(f"[SKILL] skill_trigger received, len={len(request.skill_trigger)}", file=sys.stderr, flush=True)
        if len(request.skill_trigger) > 200:
            parts.append(f"\n## 当前激活 Skill")
            parts.append(f"请严格按照以下 Skill 指令执行：\n{request.skill_trigger}")
        else:
            skill = skills_engine.resolve_trigger(request.skill_trigger)
            if skill:
                parts.append(f"\n## 当前激活 Skill: {skill['name']}")
                parts.append(f"请严格按照以下 Skill 指令执行：\n{skill['prompt']}")

    return "\n".join(parts)
