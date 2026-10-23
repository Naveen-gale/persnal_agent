# Personal Agent

A modular personal assistant scaffold with a terminal entry point, a LangGraph
workflow, Google service integration points, and tests.

## Setup

1. Create and activate a virtual environment.
2. Install dependencies with `pip install -r requirements.txt`.
3. Copy `.env.example` to `.env` and fill in the settings you plan to use.
4. Run `python main.py`.

Google OAuth credentials and tokens are local-only and must not be committed.
Google service tools and model connectivity are placeholders until configured.

## Gmail search and summaries

From the terminal agent, search read-only with Gmail query syntax, for example
`search gmail: is:unread` or `find emails matching: subject:exam`. Search results
include headers and Gmail snippets only, with at most 10 results in the agent
workflow (the Gmail tool itself allows up to 20).

Ask for an email summary with requests such as `Summarize my unread emails`,
`Summarize emails about internships`, or `What important deadlines are
mentioned in my emails?`. Summaries use only the bounded metadata and snippets
returned by Gmail; they may not contain enough content to determine all details.
The feature is read-only and does not change messages.

## Project layout

- `main.py`: terminal entry point
- `config.py`: environment and model settings
- `graph.py`, `state.py`: workflow and state
- `router.py`, `policy.py`: intent routing and permission checks
- `tools/`: Gmail, Contacts, Photos, tasks, and reminder integration points
- `services/`: model and Google authentication integration points
- `tests/`: unit tests for the core workflow, router, and policy
