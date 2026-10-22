"""Tests for permission checks."""

from policy import requires_confirmation


def test_consequential_actions_require_confirmation() -> None:
    assert requires_confirmation("send_email")
    assert requires_confirmation("delete_photo")


def test_read_only_action_does_not_require_confirmation() -> None:
    assert not requires_confirmation("list_emails")
