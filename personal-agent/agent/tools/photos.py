"""Google Photos tool integration points for Personal AI Agent."""

import json
import os
import requests
from services.google_auth import get_google_credentials, get_current_context_tokens

IMAGEKIT_URL_ENDPOINT = os.getenv("IMAGEKIT_URL_ENDPOINT", "https://ik.imagekit.io/5jmqc8tkm")


def list_photos(max_results: int = 10) -> list[dict[str, str]]:
    """Fetch photos from Google Photos Library API and return displayable items."""
    tokens = get_current_context_tokens()
    access_token = None
    if tokens and isinstance(tokens, dict):
        access_token = tokens.get("access_token") or tokens.get("token")

    if not access_token:
        # Try getting credentials from auth provider
        try:
            creds = get_google_credentials()
            access_token = creds.token
        except Exception as err:
            raise RuntimeError(
                "Google account is not connected. Connect your Google account in the dashboard to access Google Photos."
            ) from err

    if not access_token:
        raise RuntimeError(
            "No active Google access token found. Please re-authorize Google in the dashboard."
        )

    try:
        response = requests.get(
            "https://photoslibrary.googleapis.com/v1/mediaItems",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"pageSize": min(max(max_results, 1), 25)},
            timeout=10,
        )

        if response.status_code == 403:
            # Fallback to Google Drive photos if Google Photos Library API is restricted
            drive_res = requests.get(
                "https://www.googleapis.com/drive/v3/files",
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "q": "mimeType contains 'image/' and trashed=false",
                    "fields": "files(id, name, mimeType, webContentLink, thumbnailLink, createdTime)",
                    "pageSize": min(max(max_results, 1), 25),
                    "orderBy": "createdTime desc",
                },
                timeout=10,
            )
            if drive_res.status_code == 200:
                files = drive_res.json().get("files", [])
                photos = []
                for file in files[:max_results]:
                    photos.append({
                        "id": file.get("id", ""),
                        "filename": file.get("name", "photo.jpg"),
                        "mimeType": file.get("mimeType", "image/jpeg"),
                        "url": file.get("thumbnailLink") or file.get("webContentLink", ""),
                        "creationTime": file.get("createdTime", ""),
                        "storage": "Google Drive / ImageKit CDN",
                    })
                return photos

            raise RuntimeError(
                "Insufficient Google Photos permissions. Please click 'Re-authorize Google' in your integration settings to grant Google Photos access."
            )

        if response.status_code != 200:
            raise RuntimeError(
                f"Google Photos request failed with status {response.status_code}: {response.text}"
            )

        data = response.json()
        items = data.get("mediaItems", [])

        photos = []
        for item in items[:max_results]:
            photos.append({
                "id": item.get("id", ""),
                "filename": item.get("filename", "photo.jpg"),
                "mimeType": item.get("mimeType", "image/jpeg"),
                "url": f"{item.get('baseUrl')}=w800-h600",
                "creationTime": item.get("mediaMetadata", {}).get("creationTime", ""),
                "storage": "Google Photos / ImageKit CDN",
            })

        return photos

    except requests.RequestException as err:
        raise RuntimeError(f"Could not reach Google Photos: {err}") from err
