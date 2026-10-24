"""Gmail tool integration points."""

import base64
import re
from email.mime.text import MIMEText

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


def send_email(to: str, subject: str, body: str) -> dict[str, str]:
    """Compose and send an email via Gmail API."""
    if not to or not isinstance(to, str) or not to.strip():
        raise ValueError("Please provide a recipient email address.")

    recipient = to.strip()
    # Simple email address sanity check
    if not re.search(r"[^@\s]+@[^@\s]+\.[^@\s]+", recipient):
        raise ValueError(f"'{recipient}' is not a valid email address.")

    clean_subject = (subject or "").strip() or "(no subject)"
    clean_body = (body or "").strip()

    try:
        service = get_gmail_service()
        message = MIMEText(clean_body, "plain", "utf-8")
        message["to"] = recipient
        message["subject"] = clean_subject

        encoded_raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
        result = (
            service.users()
            .messages()
            .send(userId="me", body={"raw": encoded_raw})
            .execute()
        )

        return {
            "id": result.get("id", ""),
            "to": recipient,
            "subject": clean_subject,
            "snippet": clean_body[:160] if clean_body else "(no body)",
            "status": "sent",
        }

    except HttpError as error:
        status = getattr(error.resp, "status", "unknown")
        error_str = str(error)
        if status == 403 or "insufficient" in error_str.lower() or "scope" in error_str.lower():
            raise RuntimeError(
                "Insufficient Gmail permissions to send email. "
                "Please click 'Re-authorize Google' in your Google Integration settings "
                "to grant the email sending permission (https://www.googleapis.com/auth/gmail.send)."
            ) from error
        raise RuntimeError(
            f"Gmail send request failed (HTTP {status}). {error_str}"
        ) from error
    except (HttpLib2Error, OSError, TimeoutError, TransportError) as error:
        raise RuntimeError(
            "Gmail send could not reach Google. Check your network connection and try again."
        ) from error

