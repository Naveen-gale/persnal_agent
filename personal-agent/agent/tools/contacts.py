"""Google Contacts tool integration points."""

import re
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.auth.exceptions import TransportError
from httplib2 import HttpLib2Error

from services.google_auth import get_google_credentials, get_people_service

MAX_CONTACTS_RESULTS = 100


def _get_people_service():
    """Create an authenticated Google People API client."""
    return get_people_service()


def list_contacts(max_results: int = 20) -> list[dict[str, str]]:
    """List contacts from the authenticated Google account."""
    if not 1 <= max_results <= MAX_CONTACTS_RESULTS:
        raise ValueError("max_results must be between 1 and 100.")

    contacts = []
    page_token = None

    try:
        service = _get_people_service()
        while len(contacts) < max_results:
            response = service.people().connections().list(
                resourceName="people/me",
                pageSize=min(100, max_results - len(contacts)),
                pageToken=page_token,
                personFields="names,emailAddresses,phoneNumbers",
            ).execute()

            for person in response.get("connections", []):
                names = person.get("names", [])
                display_name = names[0].get("displayName", "") if names else ""
                given_name = names[0].get("givenName", "") if names else ""
                family_name = names[0].get("familyName", "") if names else ""
                final_name = display_name or f"{given_name} {family_name}".strip() or "(No name)"

                emails = person.get("emailAddresses", [])
                phones = person.get("phoneNumbers", [])

                contacts.append({
                    "name": final_name,
                    "email": (emails[0].get("value") or "") if emails else "",
                    "phone": (phones[0].get("value") or "") if phones else "",
                })

                if len(contacts) >= max_results:
                    break

            page_token = response.get("nextPageToken")
            if not page_token:
                break

        return contacts

    except HttpError as error:
        status = getattr(error.resp, "status", "unknown")
        raise RuntimeError(
            f"Google Contacts read failed (HTTP {status}). "
            "Check People API enablement and OAuth permissions."
        ) from error
    except (HttpLib2Error, OSError, TimeoutError, TransportError) as error:
        raise RuntimeError(
            "Google Contacts could not reach Google. Check your network "
            "connection and try again."
        ) from error


def find_contacts(name: str, max_results: int = 10) -> list[dict[str, str]]:
    """Find contacts whose names or details contain the supplied text."""
    if not isinstance(name, str):
        raise ValueError("Contact name must be text.")

    name = name.strip()
    if not name:
        raise ValueError("Enter a contact name.")

    if not 1 <= max_results <= MAX_CONTACTS_RESULTS:
        raise ValueError("max_results must be between 1 and 100.")

    matches = []
    page_token = None
    query_norm = name.casefold()
    query_words = [w for w in query_norm.split() if len(w) > 1] or query_norm.split()

    try:
        service = _get_people_service()
        while True:
            response = service.people().connections().list(
                resourceName="people/me",
                pageSize=100,
                pageToken=page_token,
                personFields="names,emailAddresses,phoneNumbers",
            ).execute()

            for person in response.get("connections", []):
                names = person.get("names", [])
                display_name = names[0].get("displayName", "") if names else ""
                given_name = names[0].get("givenName", "") if names else ""
                family_name = names[0].get("familyName", "") if names else ""
                final_name = display_name or f"{given_name} {family_name}".strip() or "(No name)"

                emails = person.get("emailAddresses", [])
                phones = person.get("phoneNumbers", [])

                name_haystack = f"{final_name} {given_name} {family_name}".casefold()
                email_haystack = " ".join(e.get("value", "").casefold() for e in emails)
                phone_digits = " ".join(re.sub(r"[^\d+]", "", p.get("value", "")) for p in phones)
                query_digits = re.sub(r"[^\d+]", "", query_norm)

                matches_name = (
                    query_norm in name_haystack
                    or (query_words and all(word in name_haystack for word in query_words))
                )
                matches_email = query_norm in email_haystack
                matches_phone = (query_digits and query_digits in phone_digits) or (query_norm in phone_digits)

                if matches_name or matches_email or matches_phone:
                    matches.append({
                        "name": final_name,
                        "email": (emails[0].get("value") or "") if emails else "",
                        "phone": (phones[0].get("value") or "") if phones else "",
                    })

                    if len(matches) >= max_results:
                        return matches

            page_token = response.get("nextPageToken")
            if not page_token:
                break

        return matches

    except HttpError as error:
        status = getattr(error.resp, "status", "unknown")
        raise RuntimeError(
            f"Google Contacts search failed (HTTP {status})."
        ) from error
    except (HttpLib2Error, OSError, TimeoutError, TransportError) as error:
        raise RuntimeError(
            "Google Contacts could not reach Google. Check your network "
            "connection and try again."
        ) from error


def add_contact(
    name: str,
    phone: str = "",
    email: str = "",
) -> dict[str, str]:
    """Create a Google contact with a name and optional phone/email."""
    if not isinstance(name, str):
        raise ValueError("Contact name must be text.")

    name = name.strip()
    phone = phone.strip() if isinstance(phone, str) else ""
    email = email.strip() if isinstance(email, str) else ""

    if not name:
        raise ValueError("A contact name is required.")

    if not phone and not email:
        raise ValueError("Provide at least a phone number or email.")

    person = {
        "names": [{"givenName": name}],
    }

    if phone:
        person["phoneNumbers"] = [{"value": phone}]

    if email:
        person["emailAddresses"] = [{"value": email}]

    try:
        service = _get_people_service()
        created = service.people().createContact(
            body=person,
            personFields="names,emailAddresses,phoneNumbers",
        ).execute()

        names = created.get("names", [])
        emails = created.get("emailAddresses", [])
        phones = created.get("phoneNumbers", [])

        return {
            "name": names[0].get("displayName", name) if names else name,
            "email": (emails[0].get("value") or "") if emails else "",
            "phone": (phones[0].get("value") or "") if phones else "",
        }

    except HttpError as error:
        status = getattr(error.resp, "status", "unknown")
        raise RuntimeError(
            f"Google Contacts creation failed (HTTP {status}). "
            "Check OAuth permissions and the People API."
        ) from error
    except (HttpLib2Error, OSError, TimeoutError, TransportError) as error:
        raise RuntimeError(
            "Google Contacts could not reach Google. Check your network "
            "connection and try again."
        ) from error
