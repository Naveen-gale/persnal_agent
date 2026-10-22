"""Tests for the initial LangGraph workflow."""

from graph import build_graph


def test_graph_routes_user_input() -> None:
    result = build_graph().invoke({"user_input": "Show my inbox"})
    assert result["intent"] == "gmail"
