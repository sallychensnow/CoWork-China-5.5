"""Conversations router - persistence of chat sessions and messages."""
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

# Fixed schema for conversation storage
CONV_SCHEMA = "COWORK.DATA"


class MessagePayload(BaseModel):
    role: str
    content: str
    tool_info: str | None = None
    query_result: str | None = None


class SaveMessageRequest(BaseModel):
    session_id: str
    message: MessagePayload


class CreateSessionRequest(BaseModel):
    title: str = "New Chat"
    agent_id: str | None = None


def _get_connection():
    """Get Snowflake connection using SPCS token or local dev."""
    import os
    import snowflake.connector

    token_path = "/snowflake/session/token"
    if os.path.exists(token_path):
        with open(token_path) as f:
            token = f.read().strip()
        host = os.environ.get("SNOWFLAKE_HOST", "")
        account = os.environ.get("SNOWFLAKE_ACCOUNT", "")
        if not account and host:
            account = host.split(".")[0]
        conn = snowflake.connector.connect(
            account=account, host=host, authenticator="oauth", token=token,
            database="COWORK", schema="DATA",
            warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "COWORK_WH"),
        )
        return conn
    return snowflake.connector.connect(connection_name='china_dev')


def _ensure_tables(conn):
    """Create conversation tables if they don't exist."""
    cur = conn.cursor()
    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS {CONV_SCHEMA}.CHAT_SESSIONS (
        session_id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(255) DEFAULT 'default',
        title VARCHAR(500),
        agent_id VARCHAR(255),
        created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
        updated_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
        message_count INTEGER DEFAULT 0
    )
    """)
    cur.execute(f"""
    CREATE TABLE IF NOT EXISTS {CONV_SCHEMA}.CHAT_MESSAGES (
        message_id VARCHAR(36) PRIMARY KEY,
        session_id VARCHAR(36),
        role VARCHAR(20),
        content TEXT,
        tool_info TEXT,
        query_result TEXT,
        created_at TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
    )
    """)
    cur.close()


_tables_ensured = False


def _ensure_once():
    global _tables_ensured
    if not _tables_ensured:
        try:
            conn = _get_connection()
            _ensure_tables(conn)
            conn.close()
            _tables_ensured = True
        except Exception:
            pass


@router.get("/sessions")
async def list_sessions(user_id: str = "default", limit: int = 20):
    """List recent chat sessions."""
    _ensure_once()
    try:
        conn = _get_connection()
        cur = conn.cursor()
        cur.execute(f"""
        SELECT session_id, title, agent_id, updated_at, message_count
        FROM {CONV_SCHEMA}.CHAT_SESSIONS
        WHERE user_id = '{user_id}'
        ORDER BY updated_at DESC LIMIT {limit}
        """)
        rows = cur.fetchall()
        sessions = [
            {
                "session_id": r[0],
                "title": r[1],
                "agent_id": r[2],
                "updated_at": r[3].isoformat() if r[3] else None,
                "message_count": r[4],
            }
            for r in rows
        ]
        conn.close()
        return {"sessions": sessions}
    except Exception as e:
        return {"sessions": [], "error": str(e)}


@router.post("/sessions")
async def create_session(req: CreateSessionRequest):
    """Create a new chat session."""
    _ensure_once()
    session_id = str(uuid.uuid4())
    try:
        conn = _get_connection()
        cur = conn.cursor()
        title_escaped = req.title.replace("'", "''")
        agent_id = f"'{req.agent_id}'" if req.agent_id else "NULL"
        cur.execute(f"""
        INSERT INTO {CONV_SCHEMA}.CHAT_SESSIONS (session_id, title, agent_id)
        VALUES ('{session_id}', '{title_escaped}', {agent_id})
        """)
        conn.close()
        return {"success": True, "session_id": session_id}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/sessions/{session_id}/messages")
async def get_messages(session_id: str):
    """Get all messages for a session."""
    try:
        conn = _get_connection()
        cur = conn.cursor()
        cur.execute(f"""
        SELECT message_id, role, content, tool_info, query_result, created_at
        FROM {CONV_SCHEMA}.CHAT_MESSAGES
        WHERE session_id = '{session_id}' ORDER BY created_at ASC
        """)
        rows = cur.fetchall()
        messages = [
            {
                "message_id": r[0],
                "role": r[1],
                "content": r[2],
                "tool_info": r[3],
                "query_result": r[4],
                "created_at": r[5].isoformat() if r[5] else None,
            }
            for r in rows
        ]
        conn.close()
        return {"messages": messages}
    except Exception as e:
        return {"messages": [], "error": str(e)}


@router.post("/messages")
async def save_message(req: SaveMessageRequest):
    """Save a message to a session."""
    message_id = str(uuid.uuid4())
    try:
        conn = _get_connection()
        cur = conn.cursor()
        content_escaped = req.message.content.replace("'", "''") if req.message.content else ""
        tool_info = f"'{req.message.tool_info.replace(chr(39), chr(39)+chr(39))}'" if req.message.tool_info else "NULL"
        query_result = f"'{req.message.query_result.replace(chr(39), chr(39)+chr(39))}'" if req.message.query_result else "NULL"

        cur.execute(f"""
        INSERT INTO {CONV_SCHEMA}.CHAT_MESSAGES (message_id, session_id, role, content, tool_info, query_result)
        VALUES ('{message_id}', '{req.session_id}', '{req.message.role}', $${content_escaped}$$, {tool_info}, {query_result})
        """)
        # Update session
        cur.execute(f"""
        UPDATE {CONV_SCHEMA}.CHAT_SESSIONS
        SET updated_at = CURRENT_TIMESTAMP(),
            message_count = (SELECT COUNT(*) FROM {CONV_SCHEMA}.CHAT_MESSAGES WHERE session_id = '{req.session_id}')
        WHERE session_id = '{req.session_id}'
        """)
        conn.close()
        return {"success": True, "message_id": message_id}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.put("/sessions/{session_id}/title")
async def update_title(session_id: str, payload: dict):
    """Update session title."""
    title = payload.get("title", "").replace("'", "''")
    try:
        conn = _get_connection()
        cur = conn.cursor()
        cur.execute(f"""
        UPDATE {CONV_SCHEMA}.CHAT_SESSIONS SET title = '{title}', updated_at = CURRENT_TIMESTAMP()
        WHERE session_id = '{session_id}'
        """)
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and its messages."""
    try:
        conn = _get_connection()
        cur = conn.cursor()
        cur.execute(f"DELETE FROM {CONV_SCHEMA}.CHAT_MESSAGES WHERE session_id = '{session_id}'")
        cur.execute(f"DELETE FROM {CONV_SCHEMA}.CHAT_SESSIONS WHERE session_id = '{session_id}'")
        conn.close()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/search")
async def search_conversations(q: str, user_id: str = "default", limit: int = 20):
    """Search across sessions (title) and messages (content)."""
    if not q.strip():
        return {"results": []}
    try:
        conn = _get_connection()
        cur = conn.cursor()
        query_escaped = q.replace("'", "''")
        cur.execute(f"""
        SELECT DISTINCT s.session_id, s.title, s.updated_at, s.message_count,
            m.content AS matched_content, m.role
        FROM {CONV_SCHEMA}.CHAT_SESSIONS s
        JOIN {CONV_SCHEMA}.CHAT_MESSAGES m ON s.session_id = m.session_id
        WHERE s.user_id = '{user_id}'
          AND (LOWER(s.title) LIKE LOWER('%{query_escaped}%')
               OR LOWER(m.content) LIKE LOWER('%{query_escaped}%'))
        ORDER BY s.updated_at DESC
        LIMIT {limit}
        """)
        rows = cur.fetchall()
        results = [
            {
                "session_id": r[0],
                "title": r[1],
                "updated_at": r[2].isoformat() if r[2] else None,
                "message_count": r[3],
                "matched_content": (r[4][:150] + "...") if r[4] and len(r[4]) > 150 else r[4],
                "matched_role": r[5],
            }
            for r in rows
        ]
        conn.close()
        return {"results": results}
    except Exception as e:
        return {"results": [], "error": str(e)}
