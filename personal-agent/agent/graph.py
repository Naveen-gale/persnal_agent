import json
import re
from langgraph.graph import StateGraph, START, END
from groq import APIError

from state import AgentState
from router import (
    detect_intent,
    extract_email_summary_query,
    extract_gmail_query,
    is_contact_request,
    is_email_read_request,
    is_email_search_request,
    is_email_send_request,
    is_email_summary_request,
    parse_contact_command,
    parse_email_send_command,
)
from services.model_provider import (
    AGENT_TOOLS,
    chat_with_tools,
    generate_response,
    summarize_email_snippets,
)
from prompts import SYSTEM_PROMPT
from tools.contacts import add_contact, find_contacts, list_contacts
from tools.gmail import list_recent_emails, search_emails, send_email
from tools.photos import list_photos


def _format_send_email_success(result: dict) -> str:
    return (
        f"✅ **Email Sent Successfully via Gmail!**\n\n"
        f"• **To:** `{result['to']}`\n"
        f"• **Subject:** **{result['subject']}**\n"
        f"• **Status:** *Delivered via Gmail API*\n\n"
        f"**Preview:**\n"
        f"> {result.get('snippet', '')}"
    )


def _format_email_list(emails: list[dict], title: str) -> str:
    if not emails:
        return "No matching emails found."
    lines = [f"{title}:\n"]
    for index, email in enumerate(emails, start=1):
        lines.append(
            f"{index}. **{email['subject']}**\n"
            f"   • **From:** `{email['from']}`\n"
            f"   • **Date:** *{email['date']}*\n"
            f"   • **Preview:** {email['snippet']}\n"
        )
    return "\n".join(lines)


def _format_contacts_list(contacts: list[dict], title: str) -> str:
    if not contacts:
        return "No contacts found."
    lines = [f"{title}:\n"]
    for index, contact in enumerate(contacts, start=1):
        lines.append(
            f"{index}. **{contact['name']}**\n"
            f"   • 📞 Phone: {contact['phone'] or 'N/A'}\n"
            f"   • ✉️ Email: {contact['email'] or 'N/A'}\n"
        )
    return "\n".join(lines)


def _execute_nlu_turn(user_input: str, conversation: list[dict[str, str]]) -> tuple[str, str]:
    """Execute natural language understanding turn using Groq with tool-calling."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *conversation,
        {"role": "user", "content": user_input},
    ]

    try:
        assistant_msg = chat_with_tools(messages=messages, tools=AGENT_TOOLS)
    except Exception as err:
        # Fallback to general generation if tool calling fails
        try:
            return generate_response(user_input, conversation), "general"
        except Exception:
            return f"Agent service temporarily encountered an error: {str(err)}", "general"

    # If the model produced a conversational response with no tool calls
    if not assistant_msg.tool_calls:
        content = assistant_msg.content or ""
        intent = detect_intent(user_input)
        return content.strip(), intent

    # Handle tool calls emitted by the model
    detected_intent = "general"
    response_text = ""

    for tool_call in assistant_msg.tool_calls:
        fn_name = tool_call.function.name
        raw_args = tool_call.function.arguments or "{}"
        try:
            args = json.loads(raw_args)
        except Exception:
            args = {}

        try:
            if fn_name == "send_email":
                detected_intent = "gmail"
                to = str(args.get("to", "")).strip()
                subject = str(args.get("subject", "")).strip() or "Message from Personal AI Agent"
                body = str(args.get("body", "")).strip()

                # If recipient is a name instead of an email address, try finding in contacts
                if to and "@" not in to:
                    matches = find_contacts(to)
                    resolved_email = None
                    for c in matches:
                        if c.get("email"):
                            resolved_email = c["email"]
                            break
                    if resolved_email:
                        to = resolved_email
                    else:
                        return (
                            f"I found '{to}' in your contacts, but no email address was found. "
                            f"Please specify the email address to send to.",
                            "gmail",
                        )

                if not to or "@" not in to:
                    return "Please provide a valid recipient email address to send the message.", "gmail"

                send_result = send_email(to=to, subject=subject, body=body)
                response_text = _format_send_email_success(send_result)

            elif fn_name == "search_emails":
                detected_intent = "gmail"
                query = str(args.get("query", "in:inbox")).strip() or "in:inbox"
                max_results = min(max(int(args.get("max_results", 5)), 1), 10)
                emails = search_emails(query=query, max_results=max_results)
                response_text = _format_email_list(emails, f"Matching emails for '{query}'")

            elif fn_name == "list_recent_emails":
                detected_intent = "gmail"
                max_results = min(max(int(args.get("max_results", 5)), 1), 10)
                emails = list_recent_emails(max_results=max_results)
                if not emails:
                    response_text = "Your inbox has no messages to display."
                else:
                    response_text = _format_email_list(emails, "Here are your latest inbox emails")

            elif fn_name == "summarize_emails":
                detected_intent = "gmail"
                query = str(args.get("query", "in:inbox")).strip() or "in:inbox"
                emails = search_emails(query=query, max_results=10)
                response_text = summarize_email_snippets(emails)

            elif fn_name == "search_contacts":
                detected_intent = "contacts"
                name = str(args.get("name", "")).strip()
                contacts = find_contacts(name)
                response_text = _format_contacts_list(contacts, f"Matching contacts for '{name}'")

            elif fn_name == "list_contacts":
                detected_intent = "contacts"
                contacts = list_contacts()
                response_text = _format_contacts_list(contacts, "Here are your contacts")

            elif fn_name == "add_contact":
                detected_intent = "contacts"
                name = str(args.get("name", "")).strip()
                phone = str(args.get("phone", "")).strip()
                email = str(args.get("email", "")).strip()
                contact = add_contact(name=name, phone=phone, email=email)
                response_text = (
                    f"✅ **Contact Created Successfully!**\n\n"
                    f"• **Name:** **{contact['name']}**\n"
                    f"• 📞 **Phone:** {contact['phone'] or 'N/A'}\n"
                    f"• ✉️ **Email:** {contact['email'] or 'N/A'}"
                )

            elif fn_name == "list_photos":
                detected_intent = "photos"
                max_results = min(max(int(args.get("max_results", 5)), 1), 10)
                photos = list_photos(max_results=max_results)
                if not photos:
                    response_text = "No Google Photos found or synced."
                else:
                    lines = [f"📸 **Here are your synced Google Photos (hosted on ImageKit CDN):**\n"]
                    for index, photo in enumerate(photos, start=1):
                        lines.append(
                            f"{index}. **{photo['filename']}**\n"
                            f"   • 🔗 [View Image / CDN Link]({photo['url']})\n"
                            f"   • 📅 Date: {photo['creationTime'] or 'N/A'}\n"
                        )
                    response_text = "\n".join(lines)

            else:
                response_text = f"Unrecognized action: {fn_name}"

        except (RuntimeError, ValueError) as err:
            response_text = str(err)

    return response_text or assistant_msg.content or "Action completed.", detected_intent


def process_message(state: AgentState) -> dict:
    user_input = state["user_input"]
    conversation = state.get("conversation", [])
    intent = detect_intent(user_input)

    # 1. Fast-path: Explicit contact commands
    if intent == "contacts" and is_contact_request(user_input):
        command = parse_contact_command(user_input)
        action = command.get("action")

        try:
            if action == "list":
                contacts = list_contacts()
                response = _format_contacts_list(contacts, "Here are your contacts")
            elif action == "find":
                name = command.get("name", "")
                contacts = find_contacts(name)
                response = _format_contacts_list(contacts, f"Here are the matching contacts for '{name}'")
            elif action == "add":
                contact = add_contact(
                    name=command["name"],
                    phone=command.get("phone", ""),
                    email=command.get("email", ""),
                )
                response = (
                    f"Contact created: {contact['name']}\n"
                    f"Phone: {contact['phone'] or 'N/A'}\n"
                    f"Email: {contact['email'] or 'N/A'}"
                )
            else:
                response = (
                    "Use 'show my contacts', 'find contact: <name>', "
                    "or 'add contact: <name> | <phone> | <email>'."
                )
        except (RuntimeError, ValueError) as error:
            response = str(error)

    # 2. Fast-path: Explicit email summary request
    elif intent == "gmail" and is_email_summary_request(user_input):
        query = extract_email_summary_query(user_input)
        try:
            emails = search_emails(query, max_results=10)
            response = summarize_email_snippets(emails)
        except RuntimeError as error:
            response = f"Unable to search your emails: {error}"
        except (APIError, ValueError):
            response = "Email summarization is temporarily unavailable. Please try again."

    # 3. Fast-path: Explicit email search request (prefix based)
    elif intent == "gmail" and is_email_search_request(user_input):
        query = extract_gmail_query(user_input)
        try:
            emails = search_emails(query, max_results=10)
            response = _format_email_list(emails, "Here are the matching emails")
        except (RuntimeError, ValueError) as error:
            response = str(error)

    # 4. Fast-path: Explicit email read / latest inbox request
    elif intent == "gmail" and is_email_read_request(user_input):
        try:
            emails = list_recent_emails(max_results=10)
            if not emails:
                response = "Your inbox has no messages to display."
            else:
                response = _format_email_list(emails, "Here are your latest inbox emails")
        except (RuntimeError, ValueError) as error:
            response = str(error)

    # 5. Fast-path: Explicit email send pipe command (e.g. 'send email: a@b.com | Subj | Msg')
    elif is_email_send_request(user_input) and "|" in user_input:
        cmd = parse_email_send_command(user_input)
        if cmd.get("to") and cmd.get("body"):
            try:
                result = send_email(to=cmd["to"], subject=cmd.get("subject", ""), body=cmd["body"])
                response = _format_send_email_success(result)
                intent = "gmail"
            except (RuntimeError, ValueError) as error:
                response = str(error)
                intent = "gmail"
        else:
            response, intent = _execute_nlu_turn(user_input, conversation)

    # 6. Natural Language Email Sending, Search, Contacts, or Google Photos
    elif is_email_send_request(user_input) or intent in ("gmail", "contacts", "photos") or any(k in user_input.lower() for k in ("send", "mail", "contact", "contacts", "email", "emails", "inbox", "photo", "photos", "picture", "pictures", "imagekit")):
        response, intent = _execute_nlu_turn(user_input, conversation)

    # 7. General Assistant Chat
    else:
        intent = "general"
        response = generate_response(
            user_input=user_input,
            conversation=conversation,
        )

    updated_conversation = [
        *conversation,
        {"role": "user", "content": user_input},
        {"role": "assistant", "content": response},
    ]

    # Keep recent history bounded
    updated_conversation = updated_conversation[-20:]

    return {
        "intent": intent,
        "response": response,
        "conversation": updated_conversation,
    }


builder = StateGraph(AgentState)
builder.add_node("process_message", process_message)
builder.add_edge(START, "process_message")
builder.add_edge("process_message", END)

agent = builder.compile()


def build_graph():
    """Return the compiled LangGraph agent workflow."""
    return agent

