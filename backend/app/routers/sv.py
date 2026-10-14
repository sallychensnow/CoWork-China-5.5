"""Semantic View Builder API — CRUD for Semantic Views and YAML management."""
import logging
from fastapi import APIRouter, Query
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)


# --- Request Models ---

class ExtractMetadataRequest(BaseModel):
    tables: list[dict]  # [{"database": "DB", "schema": "SCH", "table": "TBL"}, ...]


class InferPKRequest(BaseModel):
    database: str
    schema_name: str  # 'schema' is reserved in Pydantic
    table: str
    hint_columns: list[str] | None = None
    sample_limit: int = 100000


class InferRelationshipRequest(BaseModel):
    model_yaml: str
    left_table: str
    right_table: str
    left_column: str
    right_column: str


class GenerateRequest(BaseModel):
    name: str
    description: str = ""
    tables: list[dict]
    relationships: list[dict] | None = None
    vqrs: list[dict] | None = None


class GetComponentRequest(BaseModel):
    yaml_content: str
    component: str  # tables, columns, relationships, verified_queries, etc.
    table_name: str | None = None
    column_name: str | None = None
    kind: str | None = None


class SetOperationsRequest(BaseModel):
    yaml_content: str
    operations: list[dict]


class ValidateRequest(BaseModel):
    yaml_content: str
    database: str | None = None
    schema_name: str | None = None


class DeployRequest(BaseModel):
    yaml_content: str
    name: str
    stage: str  # e.g. "DB.SCHEMA.STAGE_NAME"
    filename: str | None = None  # defaults to {name}.yaml
    create_semantic_view: bool = False
    sv_database: str | None = None
    sv_schema: str | None = None


# --- Endpoints ---

@router.get("/list")
async def list_sv(database: str = Query("COWORK"), schema: str = Query("")):
    """List all Semantic Views and Stage YAML files."""
    from app.services.sv_service import list_semantic_views
    try:
        views = await list_semantic_views(database, schema)
        return {"semantic_views": views}
    except Exception as e:
        logger.error("list_sv error: %s", e)
        return {"semantic_views": [], "error": str(e)}


@router.get("/tables")
async def list_tables(database: str = Query(...), schema: str = Query(...)):
    """List all tables in a schema."""
    from app.services.sv_service import list_tables as _list_tables
    try:
        tables = await _list_tables(database, schema)
        return {"tables": tables}
    except Exception as e:
        logger.error("list_tables error: %s", e)
        return {"tables": [], "error": str(e)}


@router.post("/extract-metadata")
async def extract_metadata(req: ExtractMetadataRequest):
    """Extract table metadata with auto-classified columns."""
    from app.services.sv_service import extract_metadata as _extract
    try:
        results = await _extract(req.tables)
        return {"tables": results}
    except Exception as e:
        logger.error("extract_metadata error: %s", e)
        return {"tables": [], "error": str(e)}


@router.post("/infer-pk")
async def infer_pk(req: InferPKRequest):
    """Infer primary key candidates for a table."""
    from app.services.sv_service import infer_pk as _infer_pk
    try:
        candidates = await _infer_pk(
            req.database, req.schema_name, req.table,
            hint_columns=req.hint_columns,
            sample_limit=req.sample_limit,
        )
        return {"candidates": candidates}
    except Exception as e:
        logger.error("infer_pk error: %s", e)
        return {"candidates": [], "error": str(e)}


@router.post("/infer-relationship")
async def infer_relationship(req: InferRelationshipRequest):
    """Infer relationship type between two tables."""
    from app.services.sv_service import infer_relationship as _infer_rel
    try:
        result = await _infer_rel(
            req.model_yaml, req.left_table, req.right_table,
            req.left_column, req.right_column,
        )
        return result
    except Exception as e:
        logger.error("infer_relationship error: %s", e)
        return {"error": str(e)}


@router.post("/generate")
async def generate_yaml(req: GenerateRequest):
    """Generate initial Semantic View YAML from metadata."""
    from app.services.sv_service import generate_yaml as _generate
    try:
        yaml_content = _generate(
            req.name, req.description, req.tables, req.relationships, req.vqrs,
        )
        return {"yaml": yaml_content}
    except Exception as e:
        logger.error("generate error: %s", e)
        return {"yaml": "", "error": str(e)}


@router.post("/get-component")
async def get_component(req: GetComponentRequest):
    """Read a component from YAML content."""
    from app.services.sv_service import get_component as _get
    try:
        kwargs = {}
        if req.table_name:
            kwargs["table_name"] = req.table_name
        if req.column_name:
            kwargs["column_name"] = req.column_name
        if req.kind:
            kwargs["kind"] = req.kind
        result = _get(req.yaml_content, req.component, **kwargs)
        return {"data": result}
    except Exception as e:
        logger.error("get_component error: %s", e)
        return {"data": None, "error": str(e)}


@router.post("/set-operations")
async def set_operations(req: SetOperationsRequest):
    """Apply batch CRUD operations to YAML content."""
    from app.services.sv_service import apply_operations
    try:
        modified_yaml = apply_operations(req.yaml_content, req.operations)
        return {"yaml": modified_yaml, "operations_applied": len(req.operations)}
    except Exception as e:
        logger.error("set_operations error: %s", e)
        return {"yaml": req.yaml_content, "error": str(e)}


@router.post("/validate")
async def validate_yaml(req: ValidateRequest):
    """Validate Semantic View YAML."""
    from app.services.sv_service import validate_yaml as _validate
    try:
        result = await _validate(req.yaml_content, req.database, req.schema_name)
        return result
    except Exception as e:
        logger.error("validate error: %s", e)
        return {"valid": False, "errors": [str(e)], "warnings": []}


@router.post("/deploy")
async def deploy(req: DeployRequest):
    """Deploy YAML to stage and optionally create Semantic View."""
    from app.services.sv_service import deploy_to_stage, create_semantic_view
    filename = req.filename or f"{req.name}.yaml"
    results = {}
    try:
        # Step 1: Upload to stage
        stage_result = await deploy_to_stage(req.yaml_content, req.stage, filename)
        results["stage"] = stage_result

        # Step 2: Optionally create Semantic View
        if req.create_semantic_view and req.sv_database and req.sv_schema:
            sv_result = await create_semantic_view(
                req.yaml_content, req.name, req.sv_database, req.sv_schema,
            )
            results["semantic_view"] = sv_result

        results["success"] = True
        return results
    except Exception as e:
        logger.error("deploy error: %s", e)
        return {"success": False, "error": str(e)}


@router.delete("/{sv_name}")
async def delete_sv(sv_name: str, database: str = Query("COWORK"),
                    schema: str = Query("APP"),
                    type: str = Query("semantic_view")):
    """Drop a Semantic View or remove a YAML model from stage."""
    from app.services.sv_service import drop_semantic_view, remove_stage_file
    try:
        if type == "semantic_model":
            result = await remove_stage_file(database, sv_name)
        else:
            result = await drop_semantic_view(sv_name, database, schema)
        return result
    except Exception as e:
        logger.error("delete_sv error: %s", e)
        return {"success": False, "error": str(e)}
