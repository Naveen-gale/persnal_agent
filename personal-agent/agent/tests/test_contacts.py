"""Unit tests for Google Contacts integration."""

from unittest.mock import MagicMock, patch

import pytest
from google.auth.exceptions import TransportError
from httplib2 import Response

import graph
from router import detect_intent, is_contact_request, parse_contact_command
from tools import contacts


def _mock_people_service(connections: list[dict] | None = None) -> MagicMock:
    service = MagicMock()
    people = service.people.return_value
    people.connections.return_value.list.return_value.execute.return_value = {
        "connections": connections or [],
    }
    return service


def _mock_person(name: str = "Alice", phone: str = "1234567890", email: str = "alice@example.com") -> dict:
    return {
        "names": [{"displayName": name}],
        "phoneNumbers": [{"value": phone}],
        "emailAddresses": [{"value": email}],
    }


# ---------------------------------------------------------------------------
# list_contacts tests
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("limit", [0, 101])
def test_list_contacts_validates_bounds(limit: int) -> None:
    with patch.object(contacts, "_get_people_service") as mock_get_service:
        with pytest.raises(ValueError, match="between 1 and 100"):
            contacts.list_contacts(max_results=limit)
    mock_get_service.assert_not_called()


def test_list_contacts_returns_formatted_data() -> None:
    person = _mock_person("Alice Smith", "1112223333", "alice@test.com")
    service = _mock_people_service([person])

    with patch.object(contacts, "_get_people_service", return_value=service):
        result = contacts.list_contacts(max_results=10)

    assert len(result) == 1
    assert result[0] == {
        "name": "Alice Smith",
        "phone": "1112223333",
        "email": "alice@test.com",
    }


def test_list_contacts_handles_empty() -> None:
    service = _mock_people_service([])
    with patch.object(contacts, "_get_people_service", return_value=service):
        assert contacts.list_contacts() == []


def test_list_contacts_wraps_http_error() -> None:
    service = MagicMock()
    service.people.return_value.connections.return_value.list.return_value.execute.side_effect = (
        contacts.HttpError(Response({"status": "403"}), b"forbidden")
    )
    with patch.object(contacts, "_get_people_service", return_value=service):
        with pytest.raises(RuntimeError, match="HTTP 403"):
            contacts.list_contacts()


def test_list_contacts_wraps_network_error() -> None:
    service = MagicMock()
    service.people.return_value.connections.return_value.list.return_value.execute.side_effect = (
        TransportError("network error")
    )
    with patch.object(contacts, "_get_people_service", return_value=service):
        with pytest.raises(RuntimeError, match="network"):
            contacts.list_contacts()


# ---------------------------------------------------------------------------
# find_contacts tests
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("query", ["", "   ", None])
def test_find_contacts_validates_name(query: str | None) -> None:
    with patch.object(contacts, "_get_people_service") as mock_get_service:
        with pytest.raises(ValueError):
            contacts.find_contacts(query)  # type: ignore[arg-type]
    mock_get_service.assert_not_called()


def test_find_contacts_matches_substring_case_insensitive() -> None:
    p1 = _mock_person("Alice Wonder", "111", "alice@test.com")
    p2 = _mock_person("Bob Builder", "222", "bob@test.com")
    service = _mock_people_service([p1, p2])

    with patch.object(contacts, "_get_people_service", return_value=service):
        matches = contacts.find_contacts("ALICE")

    assert len(matches) == 1
    assert matches[0]["name"] == "Alice Wonder"


def test_find_contacts_matches_split_names() -> None:
    p = {
        "names": [{"displayName": "Patil, Vivek", "givenName": "Vivek", "familyName": "Patil"}],
        "phoneNumbers": [{"value": "+919876543210"}],
        "emailAddresses": [{"value": "vivek@example.com"}],
    }
    service = _mock_people_service([p])
    with patch.object(contacts, "_get_people_service", return_value=service):
        matches = contacts.find_contacts("vivek patil")

    assert len(matches) == 1
    assert matches[0]["name"] == "Patil, Vivek"
    assert matches[0]["phone"] == "+919876543210"


def test_find_contacts_no_matches() -> None:
    service = _mock_people_service([_mock_person("Alice")])
    with patch.object(contacts, "_get_people_service", return_value=service):
        assert contacts.find_contacts("Charlie") == []


# ---------------------------------------------------------------------------
# add_contact tests
# ---------------------------------------------------------------------------

def test_add_contact_validates_name() -> None:
    with pytest.raises(ValueError, match="name is required"):
        contacts.add_contact(name="", phone="12345")


def test_add_contact_validates_phone_or_email() -> None:
    with pytest.raises(ValueError, match="at least a phone number or email"):
        contacts.add_contact(name="John Doe", phone="", email="")


def test_add_contact_creates_successfully() -> None:
    service = MagicMock()
    service.people.return_value.createContact.return_value.execute.return_value = {
        "names": [{"displayName": "John Doe"}],
        "phoneNumbers": [{"value": "+1234567890"}],
        "emailAddresses": [{"value": "john@example.com"}],
    }

    with patch.object(contacts, "_get_people_service", return_value=service):
        created = contacts.add_contact(
            name="John Doe",
            phone="+1234567890",
            email="john@example.com",
        )

    assert created["name"] == "John Doe"
    assert created["phone"] == "+1234567890"
    assert created["email"] == "john@example.com"
    service.people.return_value.createContact.assert_called_once()


# ---------------------------------------------------------------------------
# Router & Graph integration tests
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    ("msg", "expected_action"),
    [
        ("show my contacts", "list"),
        ("list contacts", "list"),
        ("show contacts", "list"),
        ("find contact: Rahul", "find"),
        ("find contact Rahul", "find"),
        ("search contact: Priya", "find"),
        ("can you finde the number from my contact name is : vivek patil", "find"),
        ("what is the phone number of vivek patil", "find"),
        ("find Vivek Patil in contacts", "find"),
        ("add contact: John | 555-1234 | john@test.com", "add"),
    ],
)
def test_router_detects_and_parses_contacts(msg: str, expected_action: str) -> None:
    assert detect_intent(msg) == "contacts"
    assert is_contact_request(msg)
    cmd = parse_contact_command(msg)
    assert cmd["action"] == expected_action


def test_natural_language_find_extracts_contact_name() -> None:
    msg = "can you finde the number from my contact name is : vivek patil"
    cmd = parse_contact_command(msg)
    assert cmd["action"] == "find"
    assert cmd["name"] == "vivek patil"


def test_graph_lists_contacts() -> None:
    mock_data = [
        {"name": "Alice", "phone": "123", "email": "alice@test.com"}
    ]
    with patch.object(graph, "list_contacts", return_value=mock_data):
        res = graph.process_message({"user_input": "show my contacts"})

    assert "Alice" in res["response"]
    assert "123" in res["response"]
    assert "alice@test.com" in res["response"]
    assert res["intent"] == "contacts"


def test_graph_finds_contact() -> None:
    mock_data = [
        {"name": "Vivek Patil", "phone": "+919876543210", "email": "vivek@example.com"}
    ]
    with patch.object(graph, "find_contacts", return_value=mock_data) as mock_find:
        res = graph.process_message({
            "user_input": "can you finde the number from my contact name is : vivek patil"
        })

    mock_find.assert_called_once_with("vivek patil")
    assert "Vivek Patil" in res["response"]
    assert "+919876543210" in res["response"]


def test_graph_adds_contact() -> None:
    created = {"name": "Bob", "phone": "555", "email": "bob@test.com"}
    with patch.object(graph, "add_contact", return_value=created) as mock_add:
        res = graph.process_message({
            "user_input": "add contact: Bob | 555 | bob@test.com"
        })

    mock_add.assert_called_once_with(name="Bob", phone="555", email="bob@test.com")
    assert "Contact created: Bob" in res["response"]


def test_natural_language_add_extracts_phone_and_name() -> None:
    msg = "add 9164490879 name is naveen"
    cmd = parse_contact_command(msg)
    assert cmd["action"] == "add"
    assert cmd["name"] == "naveen"
    assert cmd["phone"] == "9164490879"


def test_graph_adds_contact_natural_language() -> None:
    created = {"name": "naveen", "phone": "9164490879", "email": ""}
    with patch.object(graph, "add_contact", return_value=created) as mock_add:
        res = graph.process_message({
            "user_input": "add 9164490879 name is naveen"
        })

    mock_add.assert_called_once_with(name="naveen", phone="9164490879", email="")
    assert "Contact created: naveen" in res["response"]
    assert "9164490879" in res["response"]


def test_graph_handles_contact_error() -> None:
    with patch.object(
        graph, "list_contacts", side_effect=RuntimeError("Google People API offline")
    ):
        res = graph.process_message({"user_input": "show my contacts"})

    assert "Google People API offline" in res["response"]
