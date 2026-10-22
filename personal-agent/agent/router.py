
def detect_intent(message: str) -> str:
    text = message.lower()

    if any(word in text for word in [
        "gmail", "email", "emails", "inbox", "mail"
    ]):
        return "gmail"

    if any(word in text for word in [
        "contact", "phone number", "telephone"
    ]):
        return "contacts"

    if any(word in text for word in [
        "photo", "photos", "picture", "image"
    ]):
        return "photos"

    if any(word in text for word in [
        "remind", "reminder", "task", "todo", "to-do"
    ]):
        return "tasks"

    return "general"


def is_email_read_request(message: str) -> bool:
    text = message.lower()

    read_terms = [
        "show", "list", "check", "read", "fetch",
        "get", "view", "display",
    ]
    email_terms = [
        "email", "emails", "inbox", "gmail", "mail",
    ]
    recent_terms = [
        "latest", "recent", "new", "unread", "inbox",
    ]

    asks_to_read = any(term in text for term in read_terms)
    mentions_email = any(term in text for term in email_terms)
    asks_for_recent = any(term in text for term in recent_terms)

    return (
        mentions_email
        and (asks_to_read or asks_for_recent)
    )
