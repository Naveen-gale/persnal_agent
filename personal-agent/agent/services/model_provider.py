from groq import Groq

from config import GROQ_API_KEY, GROQ_MODEL
from prompts import SYSTEM_PROMPT

client = Groq(api_key=GROQ_API_KEY)


def generate_response(
    user_input: str,
    conversation: list[dict[str, str]],
) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *conversation,
        {"role": "user", "content": user_input},
    ]

    completion = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=0.5,
        max_tokens=800,
    )

    answer = completion.choices[0].message.content

    if not answer:
        return "I couldn't generate a response. Please try again."

    return answer.strip()