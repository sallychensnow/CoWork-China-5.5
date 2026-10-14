"""Bridge between CoWork's async FastAPI backend and ArcticSwarm's sync SwarmOrchestrator.

Handles:
1. Building ArcticswarmConfig for China-region LLMs
2. Injecting CoWork tools into ArcticSwarm's ToolFactory
3. Running the blocking orchestrator in a background thread
4. Mapping SwarmEvent callbacks to CoWork's on_progress(agents_status) format
"""
import asyncio
import logging
import os
import threading
from typing import Callable

logger = logging.getLogger(__name__)


async def run_arcticswarm_research(
    query: str,
    max_teammates: int = 3,
    timeout_seconds: float = 300,
    on_progress: Callable[[list[dict]], None] | None = None,
    agent_config: dict | None = None,
    enable_web_search: bool = True,
) -> dict:
    """Run ArcticSwarm multi-agent research in a background thread.

    Returns:
        {"status": "completed"|"timeout"|"error", "report": str,
         "mode": "arcticswarm", "agents_used": int}
    """
    from app.services.arcticswarm_llm import build_china_config
    from app.services.arcticswarm_tools import build_custom_tools

    config = build_china_config(max_teammates=max_teammates)

    # Lazy import — ArcticSwarm may not be installed in all environments
    try:
        from arcticswarm.swarm.orchestrator import SwarmOrchestrator
    except ImportError as e:
        logger.error("ArcticSwarm not installed: %s", e)
        return {"status": "error", "message": f"ArcticSwarm not installed: {e}"}

    orchestrator = SwarmOrchestrator(config, max_teammates=max_teammates)

    # Inject CoWork custom tools into the orchestrator's tool factory
    custom_tools = build_custom_tools(agent_config, enable_web_search=enable_web_search)
    _inject_custom_tools(custom_tools)

    # Track agent status for frontend progress updates
    agents_status: list[dict] = []
    report_parts: list[str] = []
    lock = threading.Lock()

    def on_swarm_event(event):
        """Map ArcticSwarm SwarmEvent -> CoWork agents_status list."""
        nonlocal agents_status
        from arcticswarm.swarm.orchestrator import (
            SwarmStarted,
            SubagentSpawned,
            SubagentClaimedTask,
            TeammateCompleted,
            TeammateFailed,
            ReportStarted,
            ReportDelta,
            SwarmComplete,
        )

        with lock:
            if isinstance(event, SwarmStarted):
                agents_status = [
                    {"id": "orchestrator", "role": "Orchestrator",
                     "task": "协调多智能体研究", "status": "running"}
                ]
            elif isinstance(event, SubagentSpawned):
                agents_status.append(
                    {"id": event.name, "role": f"Agent {event.name}",
                     "task": "等待任务分配", "status": "running"}
                )
            elif isinstance(event, SubagentClaimedTask):
                for a in agents_status:
                    if a["id"] == event.name:
                        a["task"] = event.activity[:60]
            elif isinstance(event, (TeammateCompleted, TeammateFailed)):
                for a in agents_status:
                    if a["id"] == event.name:
                        a["status"] = "done"
            elif isinstance(event, ReportStarted):
                # Mark orchestrator done, add synthesizer
                for a in agents_status:
                    if a["id"] == "orchestrator":
                        a["status"] = "done"
                agents_status.append(
                    {"id": "synthesizer", "role": "Synthesizer",
                     "task": "综合研究报告", "status": "running"}
                )
            elif isinstance(event, ReportDelta):
                report_parts.append(event.text)
            elif isinstance(event, SwarmComplete):
                for a in agents_status:
                    a["status"] = "done"

            if on_progress:
                on_progress(list(agents_status))

    # Run the blocking SwarmOrchestrator in a thread
    try:
        answer = await asyncio.wait_for(
            asyncio.to_thread(
                orchestrator.run_swarm_turn,
                question=query,
                on_swarm_event=on_swarm_event,
                timeout_seconds=timeout_seconds,
            ),
            timeout=timeout_seconds + 30,  # async wrapper slightly longer
        )
        return {
            "status": "completed",
            "mode": "arcticswarm",
            "agents_used": max_teammates,
            "report": answer or "".join(report_parts) or "（无研究结果）",
        }
    except asyncio.TimeoutError:
        logger.warning("ArcticSwarm research timed out after %ss", timeout_seconds)
        return {
            "status": "timeout",
            "message": f"ArcticSwarm 深度研究超时（{int(timeout_seconds)}秒）。请简化问题后重试。",
        }
    except Exception as e:
        logger.exception("ArcticSwarm research failed")
        return {"status": "error", "message": f"ArcticSwarm error: {e}"}


def _inject_custom_tools(custom_tools: dict) -> None:
    """Register CoWork custom tools into ArcticSwarm's ToolFactory builders.

    ToolFactory._BUILDERS is a module-level dict mapping tool name -> builder callable.
    We patch it so that when subagents request these tools, they get our wrappers.
    """
    try:
        from arcticswarm.tools.factory import ToolFactory
        for name, tool_instance in custom_tools.items():
            # The builder receives a ToolFactory instance but we ignore it — return our pre-built tool
            ToolFactory._BUILDERS[name] = lambda factory, t=tool_instance: t
            logger.info("Injected custom tool '%s' into ArcticSwarm ToolFactory", name)
    except ImportError:
        logger.warning("Could not inject custom tools — arcticswarm not installed")
    except AttributeError:
        logger.warning("ToolFactory._BUILDERS not accessible — ArcticSwarm API may have changed")
