"""
Models router - OpenAI-compatible GET /models
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(tags=["Models"])

# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------

AVAILABLE_MODELS = [
    {"id": "gpt-4o", "object": "model", "created": 1700000000, "owned_by": "openai"},
    {"id": "gpt-4o-mini", "object": "model", "created": 1700000000, "owned_by": "openai"},
    {"id": "claude-sonnet-4-6", "object": "model", "created": 1700000000, "owned_by": "anthropic"},
    {"id": "claude-haiku", "object": "model", "created": 1700000000, "owned_by": "anthropic"},
    {"id": "gemini-1.5-pro", "object": "model", "created": 1700000000, "owned_by": "google"},
    {"id": "gemini-flash", "object": "model", "created": 1700000000, "owned_by": "google"},
    {"id": "mistral-large", "object": "model", "created": 1700000000, "owned_by": "mistralai"},
    {"id": "mistral-small", "object": "model", "created": 1700000000, "owned_by": "mistralai"},
]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/models")
async def list_models():
    """
    List available models in OpenAI-compatible format.
    Compatible with: openai.models.list()
    """
    return JSONResponse(
        content={
            "object": "list",
            "data": AVAILABLE_MODELS,
        }
    )


@router.get("/models/{model_id}")
async def retrieve_model(model_id: str):
    """
    Retrieve a single model's details.
    Compatible with: openai.models.retrieve("gpt-4o")
    """
    for model in AVAILABLE_MODELS:
        if model["id"] == model_id:
            return JSONResponse(content=model)

    return JSONResponse(
        status_code=404,
        content={
            "error": {
                "message": f"The model '{model_id}' does not exist.",
                "type": "invalid_request_error",
                "code": "model_not_found",
            }
        },
    )
