"""Environment and model settings."""

import os

from dotenv import load_dotenv

load_dotenv()

GROQ_MODEL = os.getenv("GROQ_MODEL", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

GOOGLE_CLIENT_SECRETS_FILE = os.getenv(
    "GOOGLE_CLIENT_SECRETS_FILE", "credentials.json"
)
GOOGLE_TOKEN_FILE = os.getenv("GOOGLE_TOKEN_FILE", "token.json")


if not GROQ_API_KEY:
    raise RuntimeError(
        "groq api limit err "
    )
