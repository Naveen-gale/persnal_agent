"""Gmail tool integration points."""

from googleapiclient.errors import HttpError
from google.auth.exceptions import TransportError
from httplib2 import HttpLib2Error

from services.google_auth import get_gmail_service

MAX_SEARCH_RESULTS = 20
MAX_SEARCH_QUERY_LENGTH = 500


def list_recent_emails(max_results: int = 10) -> list[dict[str, str]]:
    """Return recent inbox email metadata and snippets; never modify messages."""
    if not 1 <= max_results <= MAX_SEARCH_RESULTS:
        raise ValueError("max_results must be between 1 and 20.")

    service = get_gmail_service()

    try:
        result = (
            service.users()
            .messages()
            .list(
                userId="me",
                q="in:inbox",
                maxResults=max_results,
            )
            .execute()
        )

        messages = result.get("messages", [])
        emails = []

        for message in messages:
            emails.append(_get_email_metadata(service, message["id"]))

        return emails

    except HttpError as error:
        status = getattr(error.resp, "status", "unknown")
        raise RuntimeError(
            f"Gmail API request failed (HTTP {status}). "
            "Check API enablement, OAuth consent, and permissions."
        ) from error


def _get_email_metadata(service, message_id: str) -> dict[str, str]:
    """Fetch displayable headers and Gmail's snippet, not the full body."""
    details = (
        service.users()
        .messages()
        .get(
            userId="me",
            id=message_id,
            format="metadata",
            metadataHeaders=["Subject", "From", "Date"],
        )
        .execute()
    )
    headers = {
        item["name"].lower(): item["value"]
        for item in details.get("payload", {}).get("headers", [])
    }
    return {
        "from": headers.get("from", "(unknown sender)"),
        "subject": headers.get("subject", "(no subject)"),
        "date": headers.get("date", "(unknown date)"),
        "snippet": details.get("snippet", ""),
    }


def search_emails(query: str, max_results: int = 10) -> list[dict[str, str]]:
    """Search Gmail using supported query syntax; return metadata only."""
    if not isinstance(query, str):
        raise ValueError("Gmail search query must be text.")

    query = query.strip()
    if not query:
        raise ValueError("Please provide a Gmail search query.")
    if len(query) > MAX_SEARCH_QUERY_LENGTH:
        raise ValueError(
            f"Gmail search query must be {MAX_SEARCH_QUERY_LENGTH} characters "
            "or fewer."
        )
    if not 1 <= max_results <= MAX_SEARCH_RESULTS:
        raise ValueError("max_results must be between 1 and 20.")

    try:
        service = get_gmail_service()
        result = (
            service.users()
            .messages()
            .list(userId="me", q=query, maxResults=max_results)
            .execute()
        )

        messages = result.get("messages", [])
        return [
            _get_email_metadata(service, message["id"])
            for message in messages[:max_results]
        ]

    except HttpError as error:
        status = getattr(error.resp, "status", "unknown")
        raise RuntimeError(
            f"Gmail search failed (HTTP {status}). "
            "Check your Gmail API and OAuth permissions."
        ) from error
    except (HttpLib2Error, OSError, TimeoutError, TransportError) as error:
        raise RuntimeError(
            "Gmail search could not reach Google. Check your network "
            "connection and try again."
        ) from error
