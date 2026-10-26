import contextvars
import json
import os
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/contacts",
    "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata",
]

SERVICE_NAME = "PersonalAgent-Gmail"
CREDENTIAL_NAME = "oauth_credentials"

AGENT_DIR = Path(__file__).resolve().parents[1]
CLIENT_FILE = AGENT_DIR / "credentials.json"

# Per-request context storage for web-based multi-user execution
_context_google_tokens: contextvars.ContextVar[dict | None] = contextvars.ContextVar(
    "_context_google_tokens", default=None
)
_context_synced_photos: contextvars.ContextVar[list[dict] | None] = contextvars.ContextVar(
    "_context_synced_photos", default=None
)
_context_synced_contacts: contextvars.ContextVar[list[dict] | None] = contextvars.ContextVar(
    "_context_synced_contacts", default=None
)


def set_context_tokens(tokens: dict | None) -> contextvars.Token:
    """Set per-request Google OAuth tokens for the current execution context."""
    return _context_google_tokens.set(tokens)


def reset_context_tokens(token: contextvars.Token) -> None:
    """Reset the context tokens after request execution."""
    _context_google_tokens.reset(token)


def get_current_context_tokens() -> dict | None:
    """Return the active per-request tokens if any."""
    return _context_google_tokens.get()


def set_context_synced_data(
    photos: list[dict] | None = None, contacts: list[dict] | None = None
) -> tuple[contextvars.Token, contextvars.Token]:
    """Set per-request synced photos and contacts context."""
    tok_p = _context_synced_photos.set(photos)
    tok_c = _context_synced_contacts.set(contacts)
    return tok_p, tok_c


def reset_context_synced_data(tokens: tuple[contextvars.Token, contextvars.Token]) -> None:
    """Reset synced data context tokens."""
    _context_synced_photos.reset(tokens[0])
    _context_synced_contacts.reset(tokens[1])


def get_current_synced_photos() -> list[dict] | None:
    """Return user's synced photos from ImageKit CDN in request context."""
    return _context_synced_photos.get()


def get_current_synced_contacts() -> list[dict] | None:
    """Return user's synced contacts from MongoDB in request context."""
    return _context_synced_contacts.get()


def save_credentials(creds: Credentials) -> None:
    """Store OAuth token data in Windows Credential Manager or local keyring."""
    try:
        import keyring
        keyring.set_password(
            SERVICE_NAME,
            CREDENTIAL_NAME,
            creds.to_json(),
        )
    except Exception:
        # Keyring unavailable on headless server / cloud deployment
        pass


def get_google_credentials() -> Credentials:
    """Load credentials from per-request context, saved keyring, or OAuth flow."""
    # 1. Prefer per-request credentials passed by the backend web service
    context_tokens = _context_google_tokens.get()
    if context_tokens and isinstance(context_tokens, dict):
        client_id = context_tokens.get("client_id") or os.getenv("GOOGLE_CLIENT_ID", "")
        client_secret = context_tokens.get("client_secret") or os.getenv("GOOGLE_CLIENT_SECRET", "")
        raw_scopes = context_tokens.get("scopes") or context_tokens.get("scope") or SCOPES
        if isinstance(raw_scopes, str):
            scopes = [s for s in raw_scopes.split(" ") if s.strip()]
        else:
            scopes = list(raw_scopes)

        token_val = context_tokens.get("access_token") or context_tokens.get("token")
        refresh_val = context_tokens.get("refresh_token")

        creds = Credentials(
            token=token_val,
            refresh_token=refresh_val,
            token_uri=context_tokens.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=client_id,
            client_secret=client_secret,
            scopes=scopes,
        )

        if (not creds.valid or creds.expired) and creds.refresh_token:
            try:
                creds.refresh(Request())
                context_tokens["access_token"] = creds.token
            except Exception as err:
                raise RuntimeError(f"Google token refresh failed: {err}") from err

        return creds

    # 2. Check local keyring for CLI desktop mode
    saved = None
    try:
        import keyring
        saved = keyring.get_password(SERVICE_NAME, CREDENTIAL_NAME)
    except Exception:
        saved = None

    creds = None
    if saved:
        try:
            creds = Credentials.from_authorized_user_info(
                json.loads(saved),
                scopes=SCOPES,
            )
        except (ValueError, KeyError, TypeError):
            try:
                import keyring
                keyring.delete_password(SERVICE_NAME, CREDENTIAL_NAME)
            except Exception:
                pass
            creds = None

    if creds and creds.valid:
        return creds

    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            save_credentials(creds)
            return creds
        except Exception:
            try:
                import keyring
                keyring.delete_password(SERVICE_NAME, CREDENTIAL_NAME)
            except Exception:
                pass

    # 3. Interactive CLI flow ONLY when running via terminal CLI (python main.py), never inside web server
    is_server_mode = os.getenv("AGENT_RUN_MODE") == "server"
    if not is_server_mode and CLIENT_FILE.exists():
        try:
            import sys
            if hasattr(sys, "stdin") and sys.stdin and sys.stdin.isatty():
                flow = InstalledAppFlow.from_client_secrets_file(
                    str(CLIENT_FILE),
                    SCOPES,
                )
                creds = flow.run_local_server(
                    port=0,
                    access_type="offline",
                    prompt="consent",
                )
                save_credentials(creds)
                return creds
        except Exception as err:
            raise RuntimeError(
                f"Google authorization failed: {err}. Please connect your Google account in the web dashboard."
            ) from err

    raise RuntimeError(
        "Google account is not connected. You can chat with your agent freely for general tasks, or connect your Google account in the dashboard if you want to access emails and contacts."
    )


def get_gmail_service():
    """Create an authenticated Gmail API client."""
    creds = get_google_credentials()
    return build(
        "gmail",
        "v1",
        credentials=creds,
        cache_discovery=False,
    )


def get_people_service():
    """Create an authenticated Google People API client."""
    creds = get_google_credentials()
    return build(
        "people",
        "v1",
        credentials=creds,
        cache_discovery=False,
    )
