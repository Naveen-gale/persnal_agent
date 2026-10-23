# Personal AI Agent - System Architecture

## 1. Overview

The Personal AI Agent is a decoupled, cloud-ready multi-tier system engineered to run 24/7 without requiring a personal computer to stay powered on. It provides:

1. **Independent Application Authentication:** Users log in using their own credentials (email and password), separated entirely from Google authentication.
2. **Persistent Google OAuth Integration:** Google tokens are authorized once via OAuth 2.0 offline access, encrypted at rest using AES-256-GCM in MongoDB Atlas, and reused across devices.
3. **Decoupled Python Agent Execution:** The Python LangGraph runtime is exposed as an internal microservice, receiving decrypted Google credentials on a per-request basis via Python `contextvars`.

---

## 2. High-Level Architecture Diagram

```mermaid
flowchart TD
    Client["Any Browser / Mobile Device\n(React + Vite on Vercel)"]
    Backend["Express API Server\n(Node.js on Render)"]
    DB[("MongoDB Atlas\n(Users, Chats, Encrypted Tokens)")]
    Agent["LangGraph Agent Service\n(FastAPI / Python on Render)"]
    Groq["Groq API\n(openai/gpt-oss-120b)"]
    Google["Google Workspace APIs\n(Gmail & Google Contacts)"]

    Client -->|"HTTPS / JWT Cookie"| Backend
    Backend -->|"Mongoose / TLS"| DB
    Backend -->|"Internal HTTP + X-Agent-Secret\n+ Dynamic Decrypted Tokens"| Agent
    Agent -->|"LLM Prompt / Function Calling"| Groq
    Agent -->|"OAuth2 User Credentials"| Google
```

---

## 3. Core Subsystems

### 3.1. Frontend (`frontend/`)
- **Technology:** React 18, Vite, Lucide React.
- **Hosting:** Vercel (static single-page application).
- **Communication:** Sends credentials-included requests to Express API. Supports both HTTP-only secure cookies and `Authorization: Bearer <token>` fallback to ensure functionality across cross-origin mobile and desktop browsers.

### 3.2. Express API Backend (`backend/`)
- **Technology:** Node.js (ES Modules), Express, Mongoose, Google Auth Library, Helmet, CORS, Rate-Limiter.
- **Hosting:** Render Web Service.
- **Responsibilities:**
  - Manages user accounts and bcrypt password hashing.
  - Generates CSRF-protected Google OAuth consent URLs and exchanges authorization codes for long-lived offline refresh tokens.
  - Authenticates and encrypts tokens with AES-256-GCM prior to database persistence.
  - Manages chat conversations and message threads.
  - Serves as the secure orchestrator between client requests and the internal Python agent service.

### 3.3. Python LangGraph Agent (`personal-agent/agent/` & `agent/`)
- **Technology:** Python 3.14+, LangGraph, Groq SDK, Google API Client, FastAPI, Uvicorn.
- **Hosting:** Render Web Service (internal or public with `X-Agent-Secret` header guard).
- **Responsibilities:**
  - Implements the agent graph: user prompt $\rightarrow$ router intent analysis $\rightarrow$ tool execution $\rightarrow$ response synthesis.
  - Implements dynamic credential injection: Reads `google_tokens` from request payload, sets thread-safe `contextvars`, and executes Gmail and Contacts tools with valid OAuth tokens.
  - Completely eliminates Windows Credential Manager (`keyring`) dependencies for cloud execution while maintaining local fallback for CLI testing.

---

## 4. End-to-End Sequence Flows

### 4.1. Independent User Authentication
```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant API as Express API
    participant DB as MongoDB Atlas

    User->>API: POST /api/v1/auth/login (email, password)
    API->>DB: Query User by email
    DB-->>API: User record (bcrypt hash)
    API->>API: Verify password with bcrypt
    API-->>User: Set HTTP-only Cookie + Return JWT Token
```

### 4.2. One-Time Google Account Connection
```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant API as Express API
    participant Google as Google OAuth Server
    participant DB as MongoDB Atlas

    User->>API: GET /api/v1/integrations/google/connect
    API-->>User: Redirect to Google Consent URL (with signed state)
    User->>Google: Grant permissions (Gmail & Contacts)
    Google-->>API: GET /api/v1/integrations/google/callback?code=...&state=...
    API->>Google: Exchange code for tokens (access_token, refresh_token)
    Google-->>API: Tokens payload
    API->>API: Encrypt tokens with AES-256-GCM
    API->>DB: Update user.googleIntegration
    API-->>User: Redirect back to /?google_connected=true
```

### 4.3. Chat Interaction with Tool Execution
```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser
    participant API as Express API
    participant DB as MongoDB Atlas
    participant Agent as Python FastAPI Agent
    participant Groq as Groq LLM API
    participant Google as Google APIs

    User->>API: POST /api/v1/chat { message: "Summarize my emails" }
    API->>DB: Fetch user + decrypt Google tokens (AES-256-GCM)
    API->>DB: Fetch recent conversation messages
    API->>Agent: POST /invoke { prompt, history, google_tokens, X-Agent-Secret }
    Agent->>Agent: set_context_tokens(google_tokens)
    Agent->>Groq: Determine intent & tool routing
    Groq-->>Agent: Route: Gmail Tool (list/summarize)
    Agent->>Google: Call Gmail API using context tokens
    Google-->>Agent: Email threads
    Agent->>Groq: Synthesize summary
    Groq-->>Agent: Structured Markdown summary
    Agent-->>API: { reply, tokens_refreshed }
    API->>DB: Persist user & assistant messages
    API-->>User: Return synthesized response
```
