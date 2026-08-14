"""Chat router - handles message streaming and agent orchestration."""
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    skill_trigger: str | None = None
    deep_research: bool = False
    model: str = "qwen3-235b-a22b"
    agent_id: str | None = None


@router.post("/completions")
async def chat_completions(request: ChatRequest):
    from app.services.agent_engine import run_agent

    async def generate():
        # Flush proxy buffer: send 2KB padding as SSE comment to force SPCS ingress to start streaming
        yield ": " + " " * 2048 + "\n\n"
        async for chunk in run_agent(request):
            # Pad each event to ~512 bytes to prevent proxy buffering
            msg = f"data: {chunk}\n\n"
            if len(msg) < 512:
                msg = msg.rstrip("\n") + " " * (512 - len(msg)) + "\n\n"
            yield msg
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Type": "text/event-stream; charset=utf-8",
        },
    )
