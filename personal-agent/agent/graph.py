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
    is_email_summary_request,
    parse_contact_command,
)
from services.model_provider import generate_response, summarize_email_snippets
from tools.contacts import add_contact, find_contacts, list_contacts
from tools.gmail import list_recent_emails, search_emails


def process_message(state: AgentState) -> dict:
    user_input = state["user_input"]
    conversation = state.get("conversation", [])
    intent = detect_intent(user_input)

    if intent == "contacts" and is_contact_request(user_input):
        command = parse_contact_command(user_input)
        action = command.get("action")

        try:
            if action == "list":
                contacts = list_contacts()
                if not contacts:
                    response = "No contacts found."
                else:
                    lines = ["Here are your contacts:\n"]
                    for index, contact in enumerate(contacts, start=1):
                        lines.append(
                            f"{index}. **{contact['name']}**\n"
                            f"   • 📞 Phone: {contact['phone'] or 'N/A'}\n"
                            f"   • ✉️ Email: {contact['email'] or 'N/A'}\n"
                        )
                    response = "\n".join(lines)

            elif action == "find":
                name = command.get("name", "")
                contacts = find_contacts(name)
                if not contacts:
                    response = f"No contacts found matching '{name}'."
                else:
                    lines = [f"Here are the matching contacts for '{name}':\n"]
                    for index, contact in enumerate(contacts, start=1):
                        lines.append(
                            f"{index}. **{contact['name']}**\n"
                            f"   • 📞 Phone: {contact['phone'] or 'N/A'}\n"
                            f"   • ✉️ Email: {contact['email'] or 'N/A'}\n"
                        )
                    response = "\n".join(lines)

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

    elif intent == "gmail" and is_email_summary_request(user_input):
        query = extract_email_summary_query(user_input)
        try:
            emails = search_emails(query, max_results=10)
            response = summarize_email_snippets(emails)
        except RuntimeError as error:
            response = f"Unable to search your emails: {error}"
        except (APIError, ValueError):
            response = (
                "Email summarization is temporarily unavailable. "
                "Please try again."
            )

    elif intent == "gmail" and is_email_search_request(user_input):
        query = extract_gmail_query(user_input)
        try:
            emails = search_emails(query, max_results=10)
        except (RuntimeError, ValueError) as error:
            response = str(error)
        else:
            if not emails:
                response = "No matching emails found."
            else:
                lines = ["Here are the matching emails:\n"]
                for index, email in enumerate(emails, start=1):
                    lines.append(
                        f"{index}. **{email['subject']}**\n"
                        f"   • **From:** `{email['from']}`\n"
                        f"   • **Date:** *{email['date']}*\n"
                        f"   • **Preview:** {email['snippet']}\n"
                    )
                response = "\n".join(lines)

    elif intent == "gmail" and is_email_read_request(user_input):
        try:
            emails = list_recent_emails(max_results=10)
            if not emails:
                response = "Your inbox has no messages to display."
            else:
                lines = ["Here are your latest inbox emails:\n"]
                for index, email in enumerate(emails, start=1):
                    lines.append(
                        f"{index}. **{email['subject']}**\n"
                        f"   • **From:** `{email['from']}`\n"
                        f"   • **Date:** *{email['date']}*\n"
                        f"   • **Preview:** {email['snippet']}\n"
                    )
                response = "\n".join(lines)
        except (RuntimeError, ValueError) as error:
            response = str(error)

    else:
        response = generate_response(
            user_input=user_input,
            conversation=conversation,
        )

    updated_conversation = [
        *conversation,
        {"role": "user", "content": user_input},
        {"role": "assistant", "content": response},
    ]

    # Keep recent history bounded to avoid sending an unlimited
    # amount of conversation to the model on every request.
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
