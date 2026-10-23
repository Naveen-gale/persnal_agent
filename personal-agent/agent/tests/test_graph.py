"""Tests for the initial LangGraph workflow."""

from unittest.mock import patch

from graph import build_graph


def test_graph_routes_user_input() -> None:
    with patch("graph.list_recent_emails", return_value=[]):
        result = build_graph().invoke({"user_input": "Show my inbox"})
        assert result["intent"] == "gmail"
