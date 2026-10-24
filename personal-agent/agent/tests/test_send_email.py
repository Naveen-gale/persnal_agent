"""Unit tests for Gmail sending functionality and natural language email parsing."""

import base64
from email.message import EmailMessage
from unittest.mock import MagicMock, patch
import pytest
from googleapiclient.errors import HttpError
from httplib2 import Response

import graph
from router import is_email_send_request, parse_email_send_command
from tools import gmail


def _mock_gmail_service():
    service = MagicMock()
    messages = service.users.return_value.messages.return_value
    messages.send.return_value.execute.return_value = {
        "id": "msg_send_12345",
        "threadId": "thread_12345",
        "labelIds": ["SENT"],
    }
    return service


def test_send_email_validates_recipient():
    with pytest.raises(ValueError, match="recipient email address"):
        gmail.send_email(to="", subject="Test", body="Hello")

    with pytest.raises(ValueError, match="not a valid email address"):
        gmail.send_email(to="notanemail", subject="Test", body="Hello")


def test_send_email_dispatches_message():
    service = _mock_gmail_service()
    with patch.object(gmail, "get_gmail_service", return_value=service):
        result = gmail.send_email(
            to="recipient@example.com",
            subject="Status Update",
            body="All tests are passing.",
        )

    messages = service.users.return_value.messages.return_value
    messages.send.assert_called_once()
    call_kwargs = messages.send.call_args.kwargs
    assert call_kwargs["userId"] == "me"
    raw_b64 = call_kwargs["body"]["raw"]
    decoded = base64.urlsafe_b64decode(raw_b64).decode("utf-8")

    assert "recipient@example.com" in decoded
    assert "Status Update" in decoded
    assert "QWxsIHRlc3RzIGFyZSBwYXNzaW5nLg==" in decoded or "All tests are passing." in decoded

    assert result["id"] == "msg_send_12345"
    assert result["to"] == "recipient@example.com"
    assert result["subject"] == "Status Update"
    assert result["status"] == "sent"


def test_send_email_insufficient_permissions_error():
    service = _mock_gmail_service()
    service.users.return_value.messages.return_value.send.return_value.execute.side_effect = (
        HttpError(Response({"status": "403"}), b"Insufficient Permission")
    )
    with patch.object(gmail, "get_gmail_service", return_value=service):
        with pytest.raises(RuntimeError, match="Insufficient Gmail permissions"):
            gmail.send_email(
                to="recipient@example.com",
                subject="Test",
                body="Testing permissions",
            )


def test_parse_email_send_command_pipe_format():
    cmd = parse_email_send_command("send email: alex@example.com | Project Sync | Let's meet at 4")
    assert cmd["to"] == "alex@example.com"
    assert cmd["subject"] == "Project Sync"
    assert cmd["body"] == "Let's meet at 4"


def test_parse_email_send_command_natural_format():
    cmd = parse_email_send_command("send gmail to alex@example.com with subject Meeting saying I will be there")
    assert cmd["to"] == "alex@example.com"
    assert cmd["subject"] == "Meeting"
    assert cmd["body"] == "I will be there"


def test_is_email_send_request_detection():
    assert is_email_send_request("send gmail to test@example.com saying hi") is True
    assert is_email_send_request("compose email to boss@company.com") is True
    assert is_email_send_request("email to friend@gmail.com") is True
    assert is_email_send_request("read my latest emails") is False
    assert is_email_send_request("find contact John") is False


def test_graph_fast_path_send_email():
    with patch.object(
        graph,
        "send_email",
        return_value={
            "id": "123",
            "to": "test@example.com",
            "subject": "Greetings",
            "snippet": "Hello there",
            "status": "sent",
        },
    ) as mock_send:
        result = graph.process_message({
            "user_input": "send email: test@example.com | Greetings | Hello there",
            "conversation": [],
        })
        assert result["intent"] == "gmail"
        assert "Email Sent Successfully" in result["response"]
        assert "test@example.com" in result["response"]
        mock_send.assert_called_once_with(
            to="test@example.com", subject="Greetings", body="Hello there"
        )
