from typing import TypedDict


class AgentState(TypedDict):
    user_input: str
    response: str
    intent: str
    conversation: list[dict[str, str]]

    