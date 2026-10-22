"""Tests for intent routing."""

from router import route_intent


def test_routes_known_intents() -> None:
    assert route_intent("Find a contact") == "contacts"
    assert route_intent("Set a reminder") == "reminders"


def test_unknown_input_uses_general_route() -> None:
    assert route_intent("Hello there") == "general"
