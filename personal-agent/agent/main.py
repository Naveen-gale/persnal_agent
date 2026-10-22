from graph import agent


def main():
    print("\n================================")
    print("     Personal AI Agent")
    print("================================")
    print("AI provider: Groq")
    print("Type 'exit' to stop.\n")

    conversation = []

    while True:
        try:
            user_input = input("You: ").strip()

            if user_input.lower() in {"exit", "quit"}:
                print("Agent: Goodbye!")
                break

            if not user_input:
                continue

            result = agent.invoke({
                "user_input": user_input,
                "response": "",
                "intent": "",
                "conversation": conversation,
            })

            conversation = result["conversation"]

            print(f"\nIntent: {result['intent']}")
            print(f"Agent: {result['response']}\n")

        except KeyboardInterrupt:
            print("\nAgent: Goodbye!")
            break

        except Exception as error:
            print(f"\nError: {error}")
            print(
                "Check your .env settings, internet connection, "
                "Groq API key, and model availability.\n"
            )



        result = agent.invoke({
    "user_input": user_input,
    "response": "",
    "intent": "",
    "conversation": conversation,
})

        conversation = result.get("conversation", conversation)

        print(f"\nIntent: {result['intent']}")
        print(f"Agent: {result['response']}\n")

if __name__ == "__main__":
    main()