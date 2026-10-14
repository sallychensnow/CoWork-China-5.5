"""Wrap CoWork's async tools as ArcticSwarm BaseTool instances.

ArcticSwarm subagents call tools synchronously (BaseTool.execute returns ToolResult).
CoWork's tools are async (httpx / snowflake-connector). This module bridges the gap.
"""
import asyncio
import logging
from typing import Any

from arcticswarm.tools.base import BaseTool, ToolResult

logger = logging.getLogger(__name__)


def _run_async(coro) -> Any:
    """Run an async coroutine from a sync context (called from ArcticSwarm worker threads)."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    # Inside an existing event loop (common with asyncio.to_thread) -> new thread
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(asyncio.run, coro).result(timeout=60)


class ChinaWebSearchTool(BaseTool):
    """Web search via Qwen's built-in enable_search (works in China without VPN)."""

    @property
    def name(self) -> str:
        return "web_search"

    @property
    def description(self) -> str:
        return (
            "Search the internet for real-time information. Use for current events, "
            "recent news, latest data, or anything requiring up-to-date web information."
        )

    def parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
            },
            "required": ["query"],
        }

    def execute(self, **kwargs) -> ToolResult:
        query = kwargs.get("query", "")
        try:
            from app.services.tool_executor import _exec_web_search
            result = _run_async(_exec_web_search({"query": query}))
            if result.get("success"):
                return ToolResult(output=result.get("result", "No results"), error=None)
            return ToolResult(output="", error=result.get("result", "Search failed"))
        except Exception as e:
            logger.exception("ChinaWebSearchTool failed")
            return ToolResult(output="", error=str(e))


class CortexAnalystTool(BaseTool):
    """Query structured enterprise data via Snowflake Cortex Analyst."""

    def __init__(self, agent_config: dict | None = None):
        self._agent_config = agent_config

    @property
    def name(self) -> str:
        return "query_snowflake_data"

    @property
    def description(self) -> str:
        return (
            "Query structured enterprise data (sales, metrics, KPIs, inventory) "
            "using natural language via Snowflake Cortex Analyst."
        )

    def parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "Natural language data question, e.g. '上月各区域销售额'",
                },
            },
            "required": ["question"],
        }

    def execute(self, **kwargs) -> ToolResult:
        question = kwargs.get("question", "")
        try:
            from app.services.tool_executor import _exec_cortex_analyst
            result = _run_async(_exec_cortex_analyst({"question": question}, self._agent_config))
            if result.get("success"):
                return ToolResult(output=result.get("result", "No data"), error=None)
            return ToolResult(output="", error=result.get("result", "Analyst call failed"))
        except Exception as e:
            logger.exception("CortexAnalystTool failed")
            return ToolResult(output="", error=str(e))


class CortexSearchTool(BaseTool):
    """Search enterprise documents via Snowflake Cortex Search."""

    def __init__(self, agent_config: dict | None = None):
        self._agent_config = agent_config

    @property
    def name(self) -> str:
        return "search_knowledge_base"

    @property
    def description(self) -> str:
        return (
            "Search enterprise documents (contracts, policies, reports, meeting notes) "
            "via Snowflake Cortex Search for relevant context."
        )

    def parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query for document retrieval",
                },
            },
            "required": ["query"],
        }

    def execute(self, **kwargs) -> ToolResult:
        query = kwargs.get("query", "")
        try:
            from app.services.tool_executor import _exec_cortex_search
            result = _run_async(_exec_cortex_search({"query": query}, self._agent_config))
            if result.get("success"):
                return ToolResult(output=result.get("result", "No results"), error=None)
            return ToolResult(output="", error=result.get("result", "Search failed"))
        except Exception as e:
            logger.exception("CortexSearchTool failed")
            return ToolResult(output="", error=str(e))


def build_custom_tools(
    agent_config: dict | None = None,
    enable_web_search: bool = True,
) -> dict[str, BaseTool]:
    """Build custom tool instances for ArcticSwarm subagents.

    Args:
        agent_config: CoWork agent configuration with semantic_models/search_services.
        enable_web_search: Whether to include web search tool.
    """
    tools: dict[str, BaseTool] = {
        "query_snowflake_data": CortexAnalystTool(agent_config),
        "search_knowledge_base": CortexSearchTool(agent_config),
    }
    if enable_web_search:
        tools["web_search"] = ChinaWebSearchTool()
    return tools
