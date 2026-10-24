"""FastAPI service exposing the LangGraph Personal AI Agent to the backend."""

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Mark runtime as server mode to prevent interactive CLI browser prompts
os.environ["AGENT_RUN_MODE"] = "server"

# Ensure environment is loaded from multiple standard locations
_agent_dir = Path(__file__).resolve().parent
_root_dir = _agent_dir.parent.parent
load_dotenv(_agent_dir / ".env")
load_dotenv(_root_dir / ".env")
load_dotenv(_root_dir / "backend" / ".env")
load_dotenv()

from graph import agent
from services.google_auth import (
    get_current_context_tokens,
    reset_context_tokens,
    set_context_tokens,
)

AGENT_SERVICE_SECRET = os.getenv("AGENT_SERVICE_SECRET", "")
AGENT_HOST = os.getenv("AGENT_HOST", "0.0.0.0")
AGENT_PORT = int(os.getenv("PORT", os.getenv("AGENT_PORT", "8000")))

app = FastAPI(
    title="Personal AI Agent Service",
    description="Internal service executing LangGraph workflow with tool routing",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class InvokeRequest(BaseModel):
    user_input: str = Field(..., description="Message from the user")
    conversation: list[dict[str, str]] = Field(
        default_factory=list, description="Recent conversation history"
    )
    google_tokens: dict[str, Any] | None = Field(
        default=None, description="Decrypted per-user Google OAuth credentials"
    )


class InvokeResponse(BaseModel):
    response: str
    intent: str
    conversation: list[dict[str, str]]
    google_tokens: dict[str, Any] | None = None


def _verify_secret(x_agent_secret: str | None, request: Request | None = None) -> None:
    """Verify internal service-to-service authentication header if configured."""
    expected = AGENT_SERVICE_SECRET if AGENT_SERVICE_SECRET is not None else os.getenv("AGENT_SERVICE_SECRET", "")
    expected = expected.strip()
    if not expected:
        return

    # Check incoming header from parameter or request headers
    incoming = (
        x_agent_secret
        or (request.headers.get("x-agent-secret") if request else None)
        or (request.headers.get("X-Agent-Secret") if request else None)
        or ""
    ).strip()

    # Exact match always succeeds
    if incoming == expected:
        return

    # Live check backend/.env in case secret was updated while running
    try:
        backend_env = Path(__file__).resolve().parents[2] / "backend" / ".env"
        if backend_env.exists():
            with open(backend_env, "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("AGENT_SERVICE_SECRET="):
                        val = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if incoming == val:
                            return
    except Exception:
        pass

    # In local development, allow localhost loopback calls without 401
    client_host = request.client.host if (request and request.client) else ""
    is_production = (
        os.getenv("NODE_ENV") == "production"
        or os.getenv("ENVIRONMENT") == "production"
        or os.getenv("RENDER") == "true"
    )

    if client_host in ("127.0.0.1", "localhost", "::1") and not is_production:
        return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing X-Agent-Secret authentication header.",
    )


@app.get("/health")
@app.get("/api/v1/health")
def health_check() -> dict[str, str]:
    """Health check endpoint for Render / load balancers."""
    return {"status": "ok", "service": "personal-ai-agent"}


@app.get("/capabilities")
@app.get("/api/v1/agent/capabilities")
def get_capabilities() -> dict[str, Any]:
    """Return the set of implemented agent capabilities and tools."""
    return {
        "status": "ok",
        "model": os.getenv("GROQ_MODEL", "openai/gpt-oss-120b"),
        "capabilities": {
            "general_chat": True,
            "natural_language_understanding": True,
            "gmail": {
                "read_inbox": True,
                "search": True,
                "summarize": True,
                "send": True,
            },
            "contacts": {
                "list": True,
                "find": True,
                "add": True,
            },
            "reminders": False,
            "tasks": False,
            "photos": {
                "sync_to_imagekit": True,
                "list": True,
            },
        },
    }


@app.post("/invoke", response_model=InvokeResponse)
@app.post("/api/v1/agent/invoke", response_model=InvokeResponse)
def invoke_agent(
    req: InvokeRequest,
    request: Request,
    x_agent_secret: str | None = Header(default=None, alias="X-Agent-Secret"),
) -> InvokeResponse:
    """Execute a single agent turn with conversation context and user credentials."""
    _verify_secret(x_agent_secret, request)

    # Set per-request Google credentials in thread-local context
    ctx_token = set_context_tokens(req.google_tokens)

    try:
        result = agent.invoke({
            "user_input": req.user_input,
            "response": "",
            "intent": "",
            "conversation": req.conversation,
        })

        # Retrieve any refreshed token state
        active_tokens = get_current_context_tokens()

        return InvokeResponse(
            response=result.get("response", ""),
            intent=result.get("intent", "general"),
            conversation=result.get("conversation", []),
            google_tokens=active_tokens,
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent execution error: {str(err)}",
        ) from err
    finally:
        reset_context_tokens(ctx_token)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host=AGENT_HOST, port=AGENT_PORT, reload=False)
