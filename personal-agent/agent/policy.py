"""Permissions and safety rules."""


CONFIRMATION_REQUIRED_ACTIONS = frozenset(
    {"send_email", "delete_email", "delete_contact", "delete_photo"}
)


def requires_confirmation(action: str) -> bool:
    """Whether an action requires explicit user confirmation."""
    return action in CONFIRMATION_REQUIRED_ACTIONS
