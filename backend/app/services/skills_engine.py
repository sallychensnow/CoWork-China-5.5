"""Skills Engine - load skills from Snowflake with in-memory cache."""
import os
import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_skills_cache: list[dict] = []
_cache_ts: float = 0
_CACHE_TTL = 300  # 5 minutes


def _get_connection():
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
            database="COWORK", schema="APP",
            warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "COWORK_WH"),
        )
        return conn
    # Local dev
    return snowflake.connector.connect(connection_name='kr47337')


def _load_from_db() -> list[dict]:
    global _skills_cache, _cache_ts
    now = time.time()
    if _skills_cache and (now - _cache_ts) < _CACHE_TTL:
        return _skills_cache

    try:
        conn = _get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT ID, NAME, DESCRIPTION, TRIGGER_TEXT, ICON, CATEGORY, PROMPT, AGENT_ID, IS_GLOBAL
            FROM COWORK.APP.SKILLS
            ORDER BY CATEGORY, NAME
        """)
        rows = cur.fetchall()
        conn.close()

        skills = []
        for row in rows:
            skills.append({
                "id": row[0],
                "name": row[1],
                "description": row[2] or "",
                "trigger": row[3] or row[1],
                "icon": row[4] or "⚡",
                "category": row[5] or "general",
                "prompt": row[6] or "",
                "agent_id": row[7],
                "is_global": row[8] if row[8] is not None else True,
            })
        _skills_cache = skills
        _cache_ts = now
        logger.info(f"[Skills] Loaded {len(skills)} skills from DB")
        return skills
    except Exception as e:
        logger.error(f"[Skills] DB load failed: {e}")
        return _skills_cache  # return stale cache on error


class SkillsEngine:
    def list_skills(self, agent_id: Optional[str] = None) -> list[dict]:
        skills = _load_from_db()
        result = []
        for s in skills:
            if not agent_id or s["agent_id"] == agent_id or not s["agent_id"]:
                result.append(s)
        return result

    def get_skill(self, skill_id: str) -> Optional[dict]:
        skills = _load_from_db()
        for s in skills:
            if s["id"] == skill_id:
                return s
        return None

    def resolve_trigger(self, trigger: str, context: dict | None = None) -> Optional[dict]:
        skills = _load_from_db()
        for s in skills:
            if s["trigger"].lower() in trigger.lower():
                return s
        return None

    def import_skill(self, skill_data: dict) -> dict:
        """Insert or update a skill in Snowflake."""
        global _skills_cache, _cache_ts
        try:
            conn = _get_connection()
            cur = conn.cursor()
            cur.execute("""
                MERGE INTO COWORK.APP.SKILLS t
                USING (SELECT %s AS NAME, %s AS DESCRIPTION, %s AS TRIGGER_TEXT,
                       %s AS ICON, %s AS CATEGORY, %s AS PROMPT, %s AS AGENT_ID, %s AS IS_GLOBAL) s
                ON t.NAME = s.NAME
                WHEN MATCHED THEN UPDATE SET
                    DESCRIPTION=s.DESCRIPTION, TRIGGER_TEXT=s.TRIGGER_TEXT,
                    ICON=s.ICON, CATEGORY=s.CATEGORY, PROMPT=s.PROMPT,
                    AGENT_ID=s.AGENT_ID, IS_GLOBAL=s.IS_GLOBAL
                WHEN NOT MATCHED THEN INSERT (NAME, DESCRIPTION, TRIGGER_TEXT, ICON, CATEGORY, PROMPT, AGENT_ID, IS_GLOBAL)
                    VALUES (s.NAME, s.DESCRIPTION, s.TRIGGER_TEXT, s.ICON, s.CATEGORY, s.PROMPT, s.AGENT_ID, s.IS_GLOBAL)
            """, (
                skill_data["name"], skill_data.get("description", ""),
                skill_data.get("trigger", skill_data["name"]), skill_data.get("icon", "⚡"),
                skill_data.get("category", "general"), skill_data.get("prompt", ""),
                skill_data.get("agent_id", ""), skill_data.get("is_global", True),
            ))
            conn.close()
            _cache_ts = 0  # invalidate cache
            return {"status": "saved", "name": skill_data["name"]}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def reload(self):
        global _cache_ts
        _cache_ts = 0
        _load_from_db()
