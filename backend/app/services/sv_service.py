"""Semantic View Service — wraps semantic-view CLI tools as importable Python functions.

All YAML manipulation happens in-memory (StringIO) — no temp files needed.
All Snowflake queries run in threads via asyncio.to_thread to avoid blocking the event loop.
"""
import asyncio
import io
import logging
import os
import sys
import tempfile
import yaml

logger = logging.getLogger(__name__)

# Add sv_scripts to import path
_SCRIPTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "sv_scripts")
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)


def _get_snowflake_conn():
    """Get a Snowflake connection using CoWork's connection pattern."""
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
            database=os.environ.get("SNOWFLAKE_DATABASE", "COWORK"),
            schema=os.environ.get("SNOWFLAKE_SCHEMA", "DATA"),
            warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "COWORK_WH"),
        )
        conn.cursor().execute(
            f"USE WAREHOUSE {os.environ.get('SNOWFLAKE_WAREHOUSE', 'COWORK_WH')}"
        )
        return conn
    return snowflake.connector.connect(connection_name="kr47337")


# --- Table Discovery ---

async def list_tables(database: str, schema: str) -> list[dict]:
    """List all tables in a schema with basic info."""
    def _query():
        conn = _get_snowflake_conn()
        cur = conn.cursor()
        cur = conn.cursor()
        cur.execute(f"SHOW TABLES IN {database}.{schema}")
        tables = []
        for row in cur.fetchall():
            tables.append({
                "name": row[1],
                "database": database,
                "schema": schema,
                "rows": row[5] if len(row) > 5 else 0,
                "fqn": f"{database}.{schema}.{row[1]}",
            })
        conn.close()
        return tables
    return await asyncio.to_thread(_query)


# --- Metadata Extraction ---

async def extract_metadata(tables: list[dict]) -> list[dict]:
    """Extract metadata for selected tables (columns, types, PKs, FKs, sample values).

    Args:
        tables: [{"database": "DB", "schema": "SCH", "table": "TBL"}, ...]
    Returns:
        Per-table metadata with auto-classified columns.
    """
    def _extract():
        conn = _get_snowflake_conn()
        cur = conn.cursor()
        results = []
        for t in tables:
            fqn = f"{t['database']}.{t['schema']}.{t['table']}"
            table_meta = {"name": t["table"], "database": t["database"],
                          "schema": t["schema"], "fqn": fqn, "columns": [],
                          "primary_keys": [], "foreign_keys": []}
            try:
                # DESCRIBE TABLE
                cur.execute(f"DESCRIBE TABLE {fqn}")
                for row in cur.fetchall():
                    col_name = row[0]
                    col_type = str(row[1])
                    kind = _classify_column(col_name, col_type)
                    table_meta["columns"].append({
                        "name": col_name,
                        "data_type": col_type,
                        "kind": kind,
                        "nullable": row[3] == "Y" if len(row) > 3 else True,
                        "description": "",
                        "synonyms": [],
                    })
                # SHOW PRIMARY KEYS
                try:
                    cur.execute(f"SHOW PRIMARY KEYS IN TABLE {fqn}")
                    for row in cur.fetchall():
                        table_meta["primary_keys"].append(row[4])
                except Exception:
                    pass
                # SHOW IMPORTED KEYS (foreign keys)
                try:
                    cur.execute(f"SHOW IMPORTED KEYS IN TABLE {fqn}")
                    for row in cur.fetchall():
                        table_meta["foreign_keys"].append({
                            "column": row[7],
                            "references_table": f"{row[0]}.{row[1]}.{row[2]}",
                            "references_column": row[3],
                        })
                except Exception:
                    pass
            except Exception as e:
                table_meta["error"] = str(e)
            results.append(table_meta)
        conn.close()
        return results
    return await asyncio.to_thread(_extract)


def _classify_column(name: str, dtype: str) -> str:
    """Auto-classify column kind based on name and data type."""
    name_lower = name.lower()
    dtype_lower = dtype.lower()
    if any(t in dtype_lower for t in ("date", "timestamp", "time")):
        return "time_dimension"
    if any(t in dtype_lower for t in ("number", "float", "decimal", "int", "double", "real")):
        if any(w in name_lower for w in ("amount", "total", "sum", "count", "qty",
                                          "quantity", "price", "cost", "revenue",
                                          "profit", "weight", "volume")):
            return "fact"
        if name_lower.endswith("_id") or name_lower == "id":
            return "dimension"
        return "fact"
    return "dimension"


# --- Primary Key Inference ---

async def infer_pk(database: str, schema: str, table: str,
                   hint_columns: list[str] | None = None,
                   sample_limit: int = 100000) -> list[dict]:
    """Infer primary key candidates via cardinality analysis."""
    def _infer():
        from infer_primary_keys import PrimaryKeyInferrer
        conn = _get_snowflake_conn()
        fqn = f"{database}.{schema}.{table}"
        inferrer = PrimaryKeyInferrer(conn, fqn,
                                       hint_columns=hint_columns,
                                       sample_limit=sample_limit)
        candidates = inferrer.infer()
        conn.close()
        return candidates
    return await asyncio.to_thread(_infer)


# --- Relationship Inference ---

async def infer_relationship(model_yaml: str, left_table: str, right_table: str,
                              left_column: str, right_column: str) -> dict:
    """Infer relationship type between two tables using cardinality analysis."""
    def _infer():
        if not model_yaml or not model_yaml.strip():
            return {"relationship_type": "many_to_one", "inferred": False}
        model = yaml.safe_load(model_yaml)
        if not model or not isinstance(model, dict):
            return {"relationship_type": "many_to_one", "inferred": False}
        conn = _get_snowflake_conn()
        # Find base table FQNs
        left_fqn = right_fqn = None
        for t in model.get("tables", []):
            bt = t.get("base_table", {})
            fqn = f"{bt.get('database','')}.{bt.get('schema','')}.{bt.get('table', t['name'])}"
            if t["name"] == left_table:
                left_fqn = fqn
            if t["name"] == right_table:
                right_fqn = fqn
        if not left_fqn or not right_fqn:
            conn.close()
            return {"relationship_type": "many_to_one", "inferred": False, "reason": "table not found"}
        # Check if right join column is unique (PK-like)
        try:
            cur.execute(f"SELECT COUNT(*) AS total, COUNT(DISTINCT {right_column}) AS uniq FROM {right_fqn}")
            row = cur.fetchone()
            right_unique = row[0] == row[1] if row else False
        except Exception:
            right_unique = False
        try:
            cur.execute(f"SELECT COUNT(*) AS total, COUNT(DISTINCT {left_column}) AS uniq FROM {left_fqn}")
            row = cur.fetchone()
            left_unique = row[0] == row[1] if row else False
        except Exception:
            left_unique = False
        conn.close()
        if left_unique and right_unique:
            return {"relationship_type": "one_to_one", "inferred": True}
        if right_unique:
            return {"relationship_type": "many_to_one", "inferred": True}
        if left_unique:
            return {"relationship_type": "many_to_one", "inferred": True, "swap": True,
                    "note": f"Consider swapping: {right_table} many_to_one {left_table}"}
        return {"relationship_type": "many_to_one", "inferred": False, "reason": "neither side is unique"}
    return await asyncio.to_thread(_infer)


# --- YAML Generation ---

def generate_yaml(name: str, description: str, tables: list[dict],
                   relationships: list[dict] | None = None,
                   vqrs: list[dict] | None = None) -> str:
    """Generate initial Semantic View YAML from extracted metadata."""
    model = {
        "name": name,
        "description": description,
        "tables": [],
    }
    if relationships:
        model["relationships"] = relationships

    for t in tables:
        table_def = {
            "name": t["name"],
            "description": t.get("description", f"Table {t['name']}"),
            "base_table": {
                "database": t["database"],
                "schema": t["schema"],
                "table": t["name"],
            },
            "dimensions": [],
            "time_dimensions": [],
            "facts": [],
        }
        # Add primary key if available
        pks = t.get("primary_keys", [])
        if pks:
            table_def["primary_key"] = {"columns": pks}

        for col in t.get("columns", []):
            col_def = {
                "name": col["name"],
                "expr": col["name"],
                "data_type": col["data_type"],
                "description": col.get("description", ""),
            }
            if col.get("synonyms"):
                col_def["synonyms"] = col["synonyms"]

            kind = col.get("kind", "dimension")
            if kind == "time_dimension":
                table_def["time_dimensions"].append(col_def)
            elif kind == "fact":
                table_def["facts"].append(col_def)
            else:
                table_def["dimensions"].append(col_def)

        model["tables"].append(table_def)

    if vqrs:
        model["verified_queries"] = [
            {"name": v["name"], "question": v["question"], "sql": v["sql"]}
            for v in vqrs if v.get("name") and v.get("sql")
        ]

    return yaml.dump(model, default_flow_style=False, allow_unicode=True, sort_keys=False)


# --- YAML Read (GET wrapper) ---

def get_component(yaml_content: str, component: str, **kwargs) -> dict | list | str:
    """Read a component from in-memory YAML content."""
    from semantic_view_get import SemanticModelGetter
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
        f.write(yaml_content)
        tmp_path = f.name
    try:
        getter = SemanticModelGetter(tmp_path)
        method = getattr(getter, f"get_{component}", None)
        if method is None:
            return {"error": f"Unknown component: {component}"}
        return method(**kwargs)
    finally:
        os.unlink(tmp_path)


# --- YAML Modify (SET wrapper) ---

def apply_operations(yaml_content: str, operations: list[dict]) -> str:
    """Apply batch CRUD operations to YAML content, return modified YAML.

    Operations follow the semantic_view_set.py format:
    [{"operation": "create|update|delete", "component": "...", ...}, ...]
    """
    import json as json_mod
    from semantic_view_set import SemanticModelSetter

    # Write input to temp file
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as fin:
        fin.write(yaml_content)
        in_path = fin.name
    out_path = in_path + ".out.yaml"

    try:
        setter = SemanticModelSetter(in_path, out_path, json_mod.dumps(operations))
        setter.apply()
        with open(out_path, "r") as f:
            return f.read()
    finally:
        for p in (in_path, out_path):
            if os.path.exists(p):
                os.unlink(p)


# --- Validation ---

async def validate_yaml(yaml_content: str, database: str | None = None,
                         schema: str | None = None) -> dict:
    """Validate Semantic View YAML structure and optionally against Snowflake."""
    errors = []
    warnings = []

    # Basic YAML parse check
    try:
        model = yaml.safe_load(yaml_content)
    except yaml.YAMLError as e:
        return {"valid": False, "errors": [f"YAML parse error: {e}"], "warnings": []}

    if not isinstance(model, dict):
        return {"valid": False, "errors": ["YAML root must be a mapping"], "warnings": []}

    # Required fields
    if "name" not in model:
        errors.append("Missing required field: name")
    if "tables" not in model or not model["tables"]:
        errors.append("Missing required field: tables (must have at least one table)")

    # Relationship validation
    for rel in model.get("relationships", []):
        rel_type = rel.get("relationship_type", "")
        if rel_type not in ("many_to_one", "one_to_one"):
            errors.append(
                f"Relationship '{rel.get('name', '?')}': invalid type '{rel_type}'. "
                f"Only 'many_to_one' and 'one_to_one' are supported."
            )

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }


# --- Deploy ---

async def deploy_to_stage(yaml_content: str, stage: str, filename: str) -> dict:
    """Upload YAML content to a Snowflake internal stage."""
    def _deploy():
        conn = _get_snowflake_conn()
        cur = conn.cursor()
        # Write to temp file with the correct filename so PUT preserves it
        tmp_dir = tempfile.mkdtemp()
        tmp_path = os.path.join(tmp_dir, filename)
        with open(tmp_path, "w") as f:
            f.write(yaml_content)
        try:
            cur.execute(f"PUT file://{tmp_path} @{stage}/ AUTO_COMPRESS=FALSE OVERWRITE=TRUE")
            result = cur.fetchall()
            conn.close()
            return {"success": True, "stage_path": f"@{stage}/{filename}", "result": str(result)}
        finally:
            os.unlink(tmp_path)
            os.rmdir(tmp_dir)
    return await asyncio.to_thread(_deploy)


async def create_semantic_view(yaml_content: str, sv_name: str,
                                database: str, schema: str) -> dict:
    """Execute CREATE OR REPLACE SEMANTIC VIEW FROM YAML."""
    def _create():
        conn = _get_snowflake_conn()
        cur = conn.cursor()
        fqn = f"{database}.{schema}.{sv_name}"
        # Escape single quotes in YAML content
        escaped = yaml_content.replace("'", "''")
        sql = f"CREATE OR REPLACE SEMANTIC VIEW {fqn} AS $${escaped}$$"
        try:
            cur.execute(sql)
            conn.close()
            return {"success": True, "fqn": fqn}
        except Exception as e:
            conn.close()
            return {"success": False, "error": str(e)}
    return await asyncio.to_thread(_create)


async def list_semantic_views(database: str = "COWORK", schema: str = "") -> list[dict]:
    """List Semantic Views + Semantic Model YAML files from stage."""
    def _list():
        conn = _get_snowflake_conn()
        cur = conn.cursor()
        views = []
        # 1. List actual Semantic View objects
        try:
            sql = f"SHOW SEMANTIC VIEWS IN DATABASE {database}" if not schema else f"SHOW SEMANTIC VIEWS IN SCHEMA {database}.{schema}"
            cur.execute(sql)
            for row in cur.fetchall():
                views.append({
                    "name": row[1] if len(row) > 1 else str(row[0]),
                    "database": database,
                    "schema": row[3] if len(row) > 3 else "",
                    "fqn": f"{database}.{row[3]}.{row[1]}" if len(row) > 3 else str(row[0]),
                    "type": "semantic_view",
                })
        except Exception as e:
            logger.warning("SHOW SEMANTIC VIEWS failed: %s", e)
        # 2. List Semantic Model YAML files from stage
        try:
            cur.execute(f"LS @{database}.APP.SEMANTIC_MODELS")
            for row in cur.fetchall():
                fname = str(row[0]).split("/")[-1]
                if fname.endswith(".yaml") or fname.endswith(".yml"):
                    stage_path = f"@{database}.APP.SEMANTIC_MODELS/{fname}"
                    views.append({
                        "name": fname.replace(".yaml", "").replace(".yml", ""),
                        "database": database,
                        "schema": "APP",
                        "fqn": stage_path,
                        "type": "semantic_model",
                    })
        except Exception as e:
            logger.debug("LS stage failed (ok): %s", e)
        conn.close()
        return views
    return await asyncio.to_thread(_list)


async def drop_semantic_view(name: str, database: str, schema: str) -> dict:
    """Drop a Semantic View."""
    def _drop():
        conn = _get_snowflake_conn()
        cur = conn.cursor()
        fqn = f"{database}.{schema}.{name}"
        try:
            cur.execute(f"DROP SEMANTIC VIEW IF EXISTS {fqn}")
            conn.close()
            return {"success": True, "fqn": fqn}
        except Exception as e:
            conn.close()
            return {"success": False, "error": str(e)}
    return await asyncio.to_thread(_drop)


async def remove_stage_file(database: str, name: str) -> dict:
    """Remove a YAML file from the SEMANTIC_MODELS stage."""
    def _remove():
        conn = _get_snowflake_conn()
        cur = conn.cursor()
        # Try both .yaml and .yml extensions
        for ext in (".yaml", ".yml"):
            stage_path = f"@{database}.APP.SEMANTIC_MODELS/{name}{ext}"
            try:
                cur.execute(f"REMOVE {stage_path}")
                conn.close()
                return {"success": True, "removed": stage_path}
            except Exception:
                continue
        conn.close()
        return {"success": False, "error": f"File {name}.yaml not found on stage"}
    return await asyncio.to_thread(_remove)
