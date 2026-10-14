"""CoWork China - FastAPI Backend (Pure API, no static serving)"""
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import chat, skills, agent_config, sources, research, conversations, agents, sv

app = FastAPI(title="CoWork China API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(research.router, prefix="/api/research", tags=["research"])
app.include_router(skills.router, prefix="/api/skills", tags=["skills"])
app.include_router(agent_config.router, prefix="/api/agent", tags=["agent"])
app.include_router(sources.router, prefix="/api/sources", tags=["sources"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["conversations"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(sv.router, prefix="/api/sv", tags=["semantic-view"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "cowork-china-api", "version": "0.2.0"}
