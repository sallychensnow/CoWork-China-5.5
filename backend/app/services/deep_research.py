"""Deep Research service — multi-agent research pattern inspired by ArcticSwarm.

Uses DashScope (Qwen) directly with proper timeouts. Implements:
1. Task decomposition (orchestrator)
2. Parallel sub-agent research (with per-call timeout)
3. Synthesis into final report

This replaces the raw ArcticSwarm orchestrator which hangs due to
incompatible tool execution (web_search/web_fetch blocked in China,
no thread-level timeout possible with sync code).
"""
import asyncio
import logging
import os
import httpx

logger = logging.getLogger(__name__)

_DASHSCOPE_URL = "https://llm-epvjbnzw1zc7ogds.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"
_MODEL = "qwen-plus"
_CALL_TIMEOUT = 90  # seconds per LLM call (Synthesizer needs more time for long inputs)


async def _llm_call(messages: list[dict], system: str = "", enable_search: bool = False, timeout: int = _CALL_TIMEOUT, max_tokens: int = 4096) -> str:
    """Single LLM call with timeout and error handling."""
    api_key = os.environ.get("DASHSCOPE_API_KEY", "")
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    payload = {
        "model": _MODEL,
        "messages": [{"role": "system", "content": system}] + messages if system else messages,
        "max_tokens": max_tokens,
        "enable_thinking": False,
    }
    if enable_search:
        payload["enable_search"] = True

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{_DASHSCOPE_URL}/chat/completions",
            headers=headers,
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def run_deep_research(query: str, max_teammates: int = 3, on_progress=None) -> dict:
    """Multi-step deep research with proper timeouts."""
    api_key = os.environ.get("DASHSCOPE_API_KEY", "")
    if not api_key:
        return {"status": "error", "message": "DASHSCOPE_API_KEY not set"}

    def _update_progress(agents_status):
        if on_progress:
            on_progress(agents_status)

    try:
        # Step 1: Decompose query into research subtasks
        print(f"[DeepResearch] Decomposing query: {query[:80]}...")
        agents_status = [{"id": "orchestrator", "role": "Orchestrator", "task": "分解研究任务", "status": "running"}]
        _update_progress(agents_status)

        decompose_prompt = (
            "你是一个研究任务规划者。将用户的研究问题分解为2-3个独立的子任务。\n"
            "每个子任务应该从不同角度分析问题。\n"
            "用以下格式输出（每行一个子任务）：\n"
            "TASK1: [子任务描述]\n"
            "TASK2: [子任务描述]\n"
            "TASK3: [子任务描述]\n"
            "只输出任务列表，不需要其他内容。"
        )
        tasks_text = await _llm_call(
            [{"role": "user", "content": query}],
            system=decompose_prompt,
        )
        print(f"[DeepResearch] Tasks decomposed: {tasks_text[:200]}")

        # Parse subtasks
        subtasks = []
        for line in tasks_text.strip().split("\n"):
            line = line.strip()
            if line.startswith("TASK") and ":" in line:
                subtasks.append(line.split(":", 1)[1].strip())
        if not subtasks:
            subtasks = [query]

        # Update progress: orchestrator done, agents starting
        agents_status[0]["status"] = "done"
        for i, task in enumerate(subtasks[:max_teammates]):
            agents_status.append({"id": f"agent_{i+1}", "role": f"Research Agent {i+1}", "task": task[:60], "status": "running"})
        _update_progress(agents_status)

        # Step 2: Execute subtasks in parallel
        print(f"[DeepResearch] Running {len(subtasks)} subtasks in parallel...")

        async def run_subtask(task_desc: str, idx: int) -> str:
            agent_system = (
                f"你是研究员 Agent-{idx+1}。你的任务是深入研究以下子课题，提供详细分析。\n"
                "请结合你的知识和网络搜索结果给出全面分析。\n"
                "如果涉及数据分析，请说明数据来源和分析方法。\n"
                "用中文回答，条理清晰。"
            )
            try:
                result = await _llm_call(
                    [{"role": "user", "content": f"研究任务: {task_desc}\n\n原始问题背景: {query}"}],
                    system=agent_system,
                    enable_search=True,
                )
                print(f"[DeepResearch] Agent-{idx+1} completed ({len(result)} chars)")
                # Update this agent's status to done
                for a in agents_status:
                    if a["id"] == f"agent_{idx+1}":
                        a["status"] = "done"
                _update_progress(agents_status)
                return f"## Agent-{idx+1} 研究结果\n**任务**: {task_desc}\n\n{result}"
            except Exception as e:
                print(f"[DeepResearch] Agent-{idx+1} failed: {e}")
                for a in agents_status:
                    if a["id"] == f"agent_{idx+1}":
                        a["status"] = "done"
                _update_progress(agents_status)
                return f"## Agent-{idx+1}\n**任务**: {task_desc}\n\n（研究失败: {e}）"

        results = await asyncio.gather(
            *[run_subtask(task, i) for i, task in enumerate(subtasks[:max_teammates])]
        )

        # Step 3: Synthesize
        print("[DeepResearch] Synthesizing final report...")
        agents_status.append({"id": "synthesizer", "role": "Synthesizer", "task": "综合分析报告", "status": "running"})
        _update_progress(agents_status)

        combined = "\n\n---\n\n".join(results)
        synthesis_prompt = (
            "你是一个高级研究分析师。基于多个研究员的分析结果，撰写一份综合研究报告。\n"
            "要求：\n"
            "1. 综合各方观点，消除重复\n"
            "2. 突出关键发现和洞察\n"
            "3. 提供可行建议\n"
            "4. 用清晰的章节结构组织\n"
            "5. 用中文输出\n"
            "不要提及'研究员'或'Agent'，直接呈现综合后的分析报告。"
        )
        report = await _llm_call(
            [{"role": "user", "content": f"原始问题: {query}\n\n各研究员的分析结果:\n\n{combined}"}],
            system=synthesis_prompt,
            enable_search=False,
            timeout=150,
            max_tokens=8192,
        )

        # All done
        for a in agents_status:
            if a["id"] == "synthesizer":
                a["status"] = "done"
        _update_progress(agents_status)

        print(f"[DeepResearch] Report completed ({len(report)} chars)")
        return {
            "status": "completed",
            "mode": "multi-agent",
            "agents_used": len(subtasks[:max_teammates]),
            "report": report,
        }

    except httpx.TimeoutException:
        return {"status": "timeout", "message": "深度研究 LLM 调用超时，请稍后重试。"}
    except Exception as e:
        import traceback
        return {"status": "error", "message": f"Deep research failed: {e}", "traceback": traceback.format_exc()}
