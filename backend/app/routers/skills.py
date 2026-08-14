"""Skills router - list, get, import, and trigger skills."""
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from typing import Optional

from app.services.skills_engine import SkillsEngine

router = APIRouter()
engine = SkillsEngine()


class SkillTriggerRequest(BaseModel):
    trigger: str
    context: dict | None = None


@router.get("")
@router.get("/")
async def list_skills(agent_id: Optional[str] = None):
    return engine.list_skills(agent_id=agent_id)


@router.get("/{skill_id}")
async def get_skill(skill_id: str):
    return engine.get_skill(skill_id)


@router.post("/trigger")
async def trigger_skill(request: SkillTriggerRequest):
    return engine.resolve_trigger(request.trigger, request.context)


@router.post("/import")
async def import_skill(file: UploadFile = File(...)):
    content = await file.read()
    # Parse .md frontmatter format for backward compat
    import re
    text = content.decode("utf-8")
    fm_match = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.DOTALL)
    if not fm_match:
        return {"status": "error", "message": "Invalid skill format"}
    frontmatter, body = fm_match.group(1), fm_match.group(2).strip()
    meta = {}
    for line in frontmatter.strip().split("\n"):
        if ":" in line:
            key, val = line.split(":", 1)
            meta[key.strip()] = val.strip().strip('"')
    skill_data = {
        "id": meta.get("name", file.filename.replace(".md", "")),
        "name": meta.get("name", ""),
        "description": meta.get("description", ""),
        "trigger": meta.get("trigger", meta.get("name", "")),
        "icon": meta.get("icon", "⚡"),
        "category": meta.get("category", "general"),
        "prompt": body,
        "agent_id": meta.get("agent_id"),
        "is_global": meta.get("is_global", "true").lower() == "true",
    }
    return engine.import_skill(skill_data)
