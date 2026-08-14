"""Deep Research async router — POST to start, GET to poll results."""
import asyncio
import uuid
import logging
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory task store (single-instance service, fine for demo)
_tasks: dict[str, dict] = {}

# Hard timeout for the entire research operation
_RESEARCH_TIMEOUT = 180  # 3 minutes


class ResearchRequest(BaseModel):
    query: str
    messages: list[dict] = []
    agent_id: str | None = None


@router.post("/start")
async def start_research(req: ResearchRequest):
    """Start a deep research task asynchronously. Returns task_id immediately."""
    task_id = str(uuid.uuid4())[:8]
    _tasks[task_id] = {"status": "running", "result": None}
    asyncio.create_task(_run_research(task_id, req.query, req.messages, req.agent_id))
    return {"task_id": task_id, "status": "running"}


@router.get("/status/{task_id}")
async def get_research_status(task_id: str):
    """Poll research task status."""
    task = _tasks.get(task_id)
    if not task:
        return {"status": "not_found"}
    return task


async def _run_research(task_id: str, query: str, messages: list[dict], agent_id: str | None = None):
    """Background task that runs deep research with hard timeout."""
    try:
        # Load agent config for data source context
        agent_config = None
        if agent_id:
            from app.services.agent_engine import _load_active_agent_sync
            agent_config = await asyncio.to_thread(_load_active_agent_sync, agent_id)

        from app.services.tool_executor import _exec_deep_research
        # Pass progress callback to update sub-agent status
        def on_progress(agents_status: list[dict]):
            _tasks[task_id]["sub_agents"] = agents_status

        result = await asyncio.wait_for(
            _exec_deep_research({"query": query}, agent_config, on_progress=on_progress),
            timeout=_RESEARCH_TIMEOUT,
        )
        _tasks[task_id] = {"status": "completed", "result": result, "sub_agents": _tasks[task_id].get("sub_agents", [])}
        logger.info(f"Research {task_id} completed, success={result.get('success')}")
    except asyncio.TimeoutError:
        logger.warning(f"Research {task_id} timed out after {_RESEARCH_TIMEOUT}s")
        _tasks[task_id] = {
            "status": "completed",
            "result": {
                "success": False,
                "result": f"深度研究超时（{_RESEARCH_TIMEOUT}秒）。请简化问题后重试。",
            },
        }
    except Exception as e:
        logger.error(f"Research {task_id} failed: {e}")
        _tasks[task_id] = {
            "status": "error",
            "result": {"success": False, "result": str(e)},
        }
