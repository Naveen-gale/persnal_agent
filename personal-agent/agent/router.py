import re


def detect_intent(message: str) -> str:
    text = message.lower()

    if any(word in text for word in [
        "gmail", "email", "emails", "inbox", "mail"
    ]):
        return "gmail"

    if is_contact_request(message):
        return "contacts"

    if any(word in text for word in [
        "contact", "contacts", "phone number", "telephone", "phone"
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


def route_intent(message: str) -> str:
    """Route user message to intent for backwards compatibility."""
    text = message.lower()
    if any(word in text for word in ["remind", "reminder"]):
        return "reminders"
    return detect_intent(message)


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


def is_email_send_request(message: str) -> bool:
    """Detect if the message is asking to compose or send an email."""
    text = message.lower().strip()
    send_phrases = (
        "send gmail", "send email", "send an email", "send a mail", "send mail",
        "email to", "send to", "compose email", "compose gmail", "shoot an email", "mail to"
    )
    if any(phrase in text for phrase in send_phrases):
        return True
    if "@" in text and any(w in text for w in ("send", "email", "mail")):
        return True
    return False


def parse_email_send_command(message: str) -> dict:
    """Extract recipient email, subject, and body from command or natural phrasing."""
    text = message.strip()

    # 1. Pipe format: 'send email: to@test.com | Subject | Body'
    if "|" in text and ("send" in text.lower() or "mail" in text.lower()):
        cleaned = re.sub(
            r"^(?:send\s+)?(?:gmail|email|mail)?\s*[:\s]*",
            "",
            text,
            flags=re.IGNORECASE,
        ).strip()
        parts = [p.strip() for p in cleaned.split("|")]
        if parts and parts[0]:
            return {
                "to": parts[0],
                "subject": parts[1] if len(parts) > 1 else "",
                "body": parts[2] if len(parts) > 2 else "",
            }

    # 2. Extract recipient email via regex
    email_match = re.search(r"\b([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b", text)
    to_email = email_match.group(1).strip() if email_match else ""

    # 3. Subject extraction if explicitly written
    subject = ""
    subj_match = re.search(r"(?:subject|subj)(?:\s+is)?\s*[:]\s*([^|,\n]+)", text, re.IGNORECASE)
    if not subj_match:
        subj_match = re.search(r"with\s+subject\s+([\"'][^\"']+[\"']|[a-zA-Z0-9\s]+?)(?=\s+(?:and|message|body|saying)|\s*$)", text, re.IGNORECASE)
    if subj_match:
        subject = subj_match.group(1).strip().strip("'\"")

    # 4. Body extraction
    body = ""
    body_match = re.search(r"(?:body|message|saying|text)\s*[:]?\s*(.+)$", text, re.IGNORECASE)
    if body_match:
        body = body_match.group(1).strip()

    return {
        "to": to_email,
        "subject": subject,
        "body": body,
    }


def is_email_search_request(message: str) -> bool:
    text = message.lower().strip()
    return (
        text.startswith("search gmail:")
        or text.startswith("search emails:")
        or text.startswith("find emails matching:")
    )


def extract_gmail_query(message: str) -> str:
    prefixes = (
        "search gmail:",
        "search emails:",
        "find emails matching:",
    )
    text = message.strip()

    for prefix in prefixes:
        if text.lower().startswith(prefix):
            return text[len(prefix):].strip()

    return ""


def is_email_summary_request(message: str) -> bool:
    """Recognize requests to summarize email content or email deadlines."""
    text = message.lower()
    mentions_email = any(
        term in text for term in ("email", "emails", "gmail", "inbox", "mail")
    )
    asks_for_summary = any(
        term in text for term in ("summarize", "summarise", "summary", "sum up")
    )
    asks_about_deadlines = "deadline" in text and any(
        term in text for term in ("what", "which", "mentioned", "due date")
    )
    return mentions_email and (asks_for_summary or asks_about_deadlines)


def extract_email_summary_query(message: str) -> str:
    """Convert common natural-language email summary requests to Gmail search."""
    text = message.lower()
    if "unread" in text:
        return "is:unread"

    query_parts = []
    if any(term in text for term in ("recent", "latest", "newest")):
        query_parts.append("newer_than:30d")
    if "deadline" in text:
        query_parts.append("deadline")

    ignored_terms = {
        "a", "about", "an", "and", "are", "emails", "email", "find", "for",
        "gmail", "important", "in", "mentioned", "me", "my", "of", "on",
        "please", "recent", "summarise", "summarize", "summary", "the", "them",
        "through", "up", "what", "which", "with", "deadlines", "deadline",
        "latest", "newest",
    }
    keywords = [
        term for term in re.findall(r"[a-z0-9@._+-]+", text)
        if term not in ignored_terms
    ]
    query_parts.extend(keywords[:3])

    return " ".join(query_parts) or "in:inbox"


def parse_contact_command(message: str) -> dict:
    """Parse explicit and natural-language commands for contact operations."""
    text = message.strip()
    lower = text.lower()

    # 1. Pipe format: 'add contact: Rahul | 999 | r@test.com'
    if "|" in text and any(k in lower for k in ("add", "save", "create", "contact", "contacts")):
        cleaned = re.sub(
            r"^(?:add|save|create)?\s*(?:to\s+)?(?:my\s+)?contacts?[:\s]*",
            "",
            text,
            flags=re.IGNORECASE,
        ).strip()
        parts = [p.strip() for p in cleaned.split("|")]
        if parts and parts[0]:
            return {
                "action": "add",
                "name": parts[0],
                "phone": parts[1] if len(parts) > 1 else "",
                "email": parts[2] if len(parts) > 2 else "",
            }
        return {"action": "invalid"}

    # 2. Add / Save / Create contact (natural language & explicit commands)
    add_verbs = ("add ", "save ", "create ", "new ")
    is_add = any(lower.startswith(v) for v in add_verbs) or (
        "contact" in lower and any(v in lower for v in ("add", "save", "create"))
    )
    if is_add:
        email = ""
        email_match = re.search(r"\b([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\b", text)
        if email_match:
            email = email_match.group(1).strip()
            text_no_email = text[:email_match.start()] + " " + text[email_match.end():]
        else:
            text_no_email = text

        phone = ""
        phone_match = re.search(r"(\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b", text_no_email)
        if phone_match and len(re.sub(r"\D", "", phone_match.group(0))) >= 7:
            phone = phone_match.group(0).strip()
            text_clean = text_no_email[:phone_match.start()] + " " + text_no_email[phone_match.end():]
        else:
            text_clean = text_no_email

        name = ""
        m_name = re.search(r"(?:contact\s+)?(?:name\s+is\s*[:]?|named)\s+([a-zA-Z0-9\s._'-]+)", text_clean, re.IGNORECASE)
        if m_name:
            name = m_name.group(1).strip()
        elif re.search(r"\b(?:as|for)\s+([a-zA-Z0-9\s._'-]+)", text_clean, re.IGNORECASE):
            m_as = re.search(r"\b(?:as|for)\s+([a-zA-Z0-9\s._'-]+)", text_clean, re.IGNORECASE)
            name = m_as.group(1).strip()
        else:
            cleaned_str = re.sub(
                r"^\s*(?:add|save|create|new)\s+(?:to\s+)?(?:my\s+)?(?:contacts?\s+)?(?:for\s+)?",
                "",
                text_clean,
                flags=re.IGNORECASE,
            )
            cleaned_str = re.sub(
                r"\b(?:with|phone|number|mobile|email|telephone|and|called|details)\b",
                "",
                cleaned_str,
                flags=re.IGNORECASE,
            )
            cleaned_str = re.sub(r"[:\?!.,;]+", "", cleaned_str).strip()
            name = cleaned_str

        name = re.sub(r"[\?!.,;:]+$", "", name).strip()

        if name and (phone or email or "contact" in lower):
            return {"action": "add", "name": name, "phone": phone, "email": email}
        elif lower.startswith("add contact:") and not name:
            return {"action": "invalid"}

    # 3. List contacts
    list_phrases = {
        "show my contacts", "list contacts", "show contacts", "contacts",
        "get contacts", "view contacts", "all contacts", "my contacts",
        "who is in my contacts", "list all contacts", "show all contacts",
    }
    if lower in list_phrases:
        return {"action": "list"}

    # 4. Explicit find prefixes
    for prefix in (
        "find contact:",
        "find contacts:",
        "search contact:",
        "search contacts:",
        "find contact ",
        "find contacts ",
        "search contact ",
        "search contacts ",
    ):
        if lower.startswith(prefix):
            name = text[len(prefix):].strip()
            return {"action": "find", "name": name}

    # 5. Pattern: 'name is : <name>' or 'named <name>'
    m = re.search(r"(?:contact\s+)?(?:name\s+is\s*[:]?|named)\s+([a-zA-Z0-9\s._'-]+)", text, re.IGNORECASE)
    if m:
        name = m.group(1).strip()
        name = re.sub(r"[\?!.,;:]+$", "", name).strip()
        if name:
            return {"action": "find", "name": name}

    # 6. Pattern: 'number of <name>' / 'phone number of <name>' / 'details of <name>'
    m = re.search(r"(?:number|phone|email|details)\s+(?:of|for)\s+([a-zA-Z0-9\s._'-]+)", text, re.IGNORECASE)
    if m:
        raw_name = m.group(1).strip()
        raw_name = re.sub(r"\s+(?:from|in)\s+(?:my\s+)?contacts?.*$", "", raw_name, flags=re.IGNORECASE).strip()
        raw_name = re.sub(r"[\?!.,;:]+$", "", raw_name).strip()
        if raw_name:
            return {"action": "find", "name": raw_name}

    # 7. Pattern: 'find <name> in [my] contacts'
    m = re.search(r"(?:find|finde|search|lookup|look up|check|get)\s+([a-zA-Z0-9\s._'-]+?)\s+(?:in|from)\s+(?:my\s+)?contacts?", text, re.IGNORECASE)
    if m:
        name = m.group(1).strip()
        if name:
            return {"action": "find", "name": name}

    # 8. Fallback natural language: if query mentions contacts and asks to find someone
    if any(k in lower for k in ("contact", "contacts")):
        cleaned = re.sub(
            r"\b(can|could|you|please|find|finde|search|lookup|look|up|check|get|the|number|phone|email|details|from|in|my|contacts?|name|is|of|for|me|tell)\b",
            "",
            lower,
            flags=re.IGNORECASE,
        )
        cleaned = re.sub(r"[:\?!.,;]+", "", cleaned).strip()
        if cleaned:
            return {"action": "find", "name": cleaned}

    return {"action": "unsupported"}


def is_contact_request(message: str) -> bool:
    """Detect if a user input is an actionable request for Google Contacts."""
    cmd = parse_contact_command(message)
    return cmd.get("action") in {"list", "find", "add", "invalid"}
