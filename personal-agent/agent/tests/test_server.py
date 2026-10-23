"""Tests for the agent FastAPI server."""

from unittest.mock import patch
from fastapi.testclient import TestClient
import server


def test_health_endpoint() -> None:
    client = TestClient(server.app)
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_capabilities_endpoint() -> None:
    client = TestClient(server.app)
    res = client.get("/capabilities")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "capabilities" in data
    assert data["capabilities"]["general_chat"] is True
    assert data["capabilities"]["gmail"]["read_inbox"] is True
    assert data["capabilities"]["contacts"]["add"] is True


def test_invoke_requires_secret_when_configured() -> None:
    client = TestClient(server.app)
    with patch.object(server, "AGENT_SERVICE_SECRET", "super_secret_key"):
        # Without header
        res = client.post("/invoke", json={"user_input": "hello"})
        assert res.status_code == 401

        # With wrong header
        res = client.post("/invoke", json={"user_input": "hello"}, headers={"X-Agent-Secret": "wrong"})
        assert res.status_code == 401

        # With correct header
        with patch.object(server.agent, "invoke", return_value={"response": "Hi", "intent": "general", "conversation": []}):
            res = client.post("/invoke", json={"user_input": "hello"}, headers={"X-Agent-Secret": "super_secret_key"})
            assert res.status_code == 200
            assert res.json()["response"] == "Hi"


def test_invoke_sets_and_cleans_context_tokens() -> None:
    client = TestClient(server.app)
    captured_tokens = []

    def mock_invoke(state):
        from services.google_auth import get_current_context_tokens
        captured_tokens.append(get_current_context_tokens())
        return {"response": "Mocked", "intent": "general", "conversation": []}

    with patch.object(server, "AGENT_SERVICE_SECRET", ""), patch.object(server.agent, "invoke", side_effect=mock_invoke):
        dummy_tokens = {"access_token": "token_abc", "refresh_token": "refresh_xyz"}
        res = client.post("/invoke", json={"user_input": "check inbox", "google_tokens": dummy_tokens})
        assert res.status_code == 200
        assert len(captured_tokens) == 1
        assert captured_tokens[0]["access_token"] == "token_abc"

    # Verify context tokens were reset after request
    from services.google_auth import get_current_context_tokens
    assert get_current_context_tokens() is None
