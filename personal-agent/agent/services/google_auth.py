
import json
from pathlib import Path

import keyring
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

SERVICE_NAME = "PersonalAgent-Gmail"
CREDENTIAL_NAME = "oauth_credentials"

AGENT_DIR = Path(__file__).resolve().parents[1]
CLIENT_FILE = AGENT_DIR / "credentials.json"


def save_credentials(creds: Credentials) -> None:
    """Store OAuth token data in Windows Credential Manager."""
    keyring.set_password(
        SERVICE_NAME,
        CREDENTIAL_NAME,
        creds.to_json(),
    )


def get_google_credentials() -> Credentials:
    """Load saved credentials or authorize through Google's browser flow."""
    saved = keyring.get_password(SERVICE_NAME, CREDENTIAL_NAME)
    creds = None

    if saved:
        try:
            creds = Credentials.from_authorized_user_info(
                json.loads(saved),
                scopes=SCOPES,
            )
        except (ValueError, KeyError, TypeError):
            # Invalid stored credentials: start a fresh authorization.
            keyring.delete_password(SERVICE_NAME, CREDENTIAL_NAME)
            creds = None

    if creds and creds.valid:
        return creds

    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            save_credentials(creds)
            return creds
        except Exception:
            # A revoked or expired refresh token requires new consent.
            keyring.delete_password(SERVICE_NAME, CREDENTIAL_NAME)

    if not CLIENT_FILE.exists():
        raise FileNotFoundError(
            f"Missing OAuth client file: {CLIENT_FILE}\n"
            "Download a Desktop app OAuth JSON file and save it "
            "as credentials.json inside the agent folder."
        )

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


def get_gmail_service():
    """Create an authenticated Gmail API client."""
    creds = get_google_credentials()
    return build(
        "gmail",
        "v1",
        credentials=creds,
        cache_discovery=False,
    )
