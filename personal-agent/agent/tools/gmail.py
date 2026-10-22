"""Gmail tool integration points."""

from googleapiclient.errors import HttpError

from services.google_auth import get_gmail_service


def list_recent_emails(max_results: int = 10) -> list[dict[str, str]]:
    """Return recent inbox email metadata and snippets; never modify messages."""
    if not 1 <= max_results <= 20:
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
            details = (
                service.users()
                .messages()
                .get(
                    userId="me",
                    id=message["id"],
                    format="metadata",
                    metadataHeaders=["Subject", "From", "Date"],
                )
                .execute()
            )

            headers = {
                item["name"].lower(): item["value"]
                for item in details.get("payload", {}).get("headers", [])
            }

            emails.append({
                "from": headers.get("from", "(unknown sender)"),
                "subject": headers.get("subject", "(no subject)"),
                "date": headers.get("date", "(unknown date)"),
                "snippet": details.get("snippet", ""),
            })

        return emails

    except HttpError as error:
        status = getattr(error.resp, "status", "unknown")
        raise RuntimeError(
            f"Gmail API request failed (HTTP {status}). "
            "Check API enablement, OAuth consent, and permissions."
        ) from error
