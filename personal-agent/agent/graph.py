
from langgraph.graph import StateGraph, START, END

from state import AgentState
from router import detect_intent, is_email_read_request
from services.model_provider import generate_response
from tools.gmail import list_recent_emails


def process_message(state: AgentState) -> dict:
    user_input = state["user_input"]
    conversation = state.get("conversation", [])
    intent = detect_intent(user_input)

    if intent == "gmail" and is_email_read_request(user_input):
        emails = list_recent_emails(max_results=10)

        if not emails:
            response = "Your inbox has no messages to display."
        else:
            lines = ["Here are your latest inbox emails:\n"]

            for index, email in enumerate(emails, start=1):
                lines.append(
                    f"{index}. {email['subject']}\n"
                    f"   From: {email['from']}\n"
                    f"   Date: {email['date']}\n"
                    f"   Preview: {email['snippet']}\n"
                )

            response = "\n".join(lines)

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
