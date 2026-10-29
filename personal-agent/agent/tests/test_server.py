"""Tests for the agent FastAPI server endpoints and security."""

import os
from unittest.mock import MagicMock, patch
import pytest
from fastapi import HTTPException
import server
from server import InvokeRequest


def test_root_endpoint() -> None:
    res = server.root()
    assert res["status"] == "ok"
    assert res["service"] == "personal-ai-agent"


def test_health_endpoint() -> None:
    res = server.health_check()
    assert res["status"] == "ok"
    assert res["service"] == "personal-ai-agent"


def test_capabilities_endpoint() -> None:
    data = server.get_capabilities()
    assert data["status"] == "ok"
    assert "capabilities" in data
    assert data["capabilities"]["general_chat"] is True
    assert data["capabilities"]["gmail"]["read_inbox"] is True
    assert data["capabilities"]["contacts"]["add"] is True
    assert data["capabilities"]["photos"]["sync_to_imagekit"] is True


def test_invoke_requires_secret_when_configured() -> None:
    with patch.dict(os.environ, {"RENDER": "true"}), patch.object(server, "AGENT_SERVICE_SECRET", "super_secret_key"):
        # Without header should raise 401
        with pytest.raises(HTTPException) as exc_info:
            server._verify_secret(None, None)
        assert exc_info.value.status_code == 401

        # With wrong header should raise 401
        with pytest.raises(HTTPException) as exc_info:
            server._verify_secret("wrong", None)
        assert exc_info.value.status_code == 401

        # With correct header should pass
        server._verify_secret("super_secret_key", None)


def test_invoke_sets_and_cleans_context_tokens() -> None:
    captured_tokens = []

    def mock_invoke(state):
        from services.google_auth import get_current_context_tokens
        captured_tokens.append(get_current_context_tokens())
        return {"response": "Mocked", "intent": "general", "conversation": []}

    mock_agent = MagicMock()
    mock_agent.invoke.side_effect = mock_invoke

    with patch.object(server, "AGENT_SERVICE_SECRET", ""), patch.object(server, "agent", mock_agent):
        dummy_tokens = {"access_token": "token_abc", "refresh_token": "refresh_xyz"}
        req = InvokeRequest(user_input="check inbox", google_tokens=dummy_tokens)
        res = server.invoke_agent(req=req, request=None, x_agent_secret=None)

        assert res.response == "Mocked"
        assert len(captured_tokens) == 1
        assert captured_tokens[0]["access_token"] == "token_abc"

    # Verify context tokens were reset after request
    from services.google_auth import get_current_context_tokens
    assert get_current_context_tokens() is None
