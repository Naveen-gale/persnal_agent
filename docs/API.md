# Personal AI Agent - REST API Reference

Base API Path: `/api/v1`

---

## 1. Authentication Endpoints (`/auth`)

### `POST /auth/register`
Creates a new application user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!",
  "name": "Alex"
}
```

**Response (`201 Created`):**
```json
{
  "message": "User registered successfully.",
  "user": {
    "id": "67191234567890abcdef1234",
    "email": "user@example.com",
    "name": "Alex",
    "role": "owner",
    "googleConnected": false
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### `POST /auth/login`
Authenticates with application credentials and sets the session cookie.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

**Response (`200 OK`):**
```json
{
  "message": "Logged in successfully.",
  "user": {
    "id": "67191234567890abcdef1234",
    "email": "user@example.com",
    "name": "Alex",
    "role": "owner",
    "googleConnected": true
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### `POST /auth/logout`
Clears the session cookie and invalidates user session.

**Response (`200 OK`):**
```json
{
  "message": "Logged out successfully."
}
```

---

### `GET /auth/me`
Retrieves current authenticated profile from cookie or Bearer token.

**Response (`200 OK`):**
```json
{
  "user": {
    "id": "67191234567890abcdef1234",
    "email": "user@example.com",
    "name": "Alex",
    "role": "owner",
    "googleConnected": true
  }
}
```

---

## 2. Google Integration Endpoints (`/integrations/google`)

### `GET /integrations/google/status`
Checks if the authenticated user has authorized Google Workspace.

**Response (`200 OK`):**
```json
{
  "integration": {
    "connected": true,
    "email": "alex.personal@gmail.com",
    "connectedAt": "2026-10-23T15:30:00.000Z",
    "scopes": [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/contacts",
      "https://www.googleapis.com/auth/userinfo.email"
    ]
  }
}
```

---

### `GET /integrations/google/connect`
Generates a signed OAuth 2.0 authorization URL for offline access consent.

**Response (`200 OK`):**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=...&access_type=offline&prompt=consent&state=..."
}
```

---

### `GET /integrations/google/callback`
OAuth 2.0 redirect target. Verifies signed state, exchanges code for refresh and access tokens, encrypts tokens with AES-256-GCM, and persists to MongoDB.

**Redirects to:** `${FRONTEND_URL}/?google_connected=true`

---

### `POST /integrations/google/disconnect`
Deletes stored encrypted Google credentials from user document.

**Response (`200 OK`):**
```json
{
  "message": "Google account disconnected successfully."
}
```

---

## 3. Chat & Conversation Endpoints (`/chat`)

### `GET /chat/conversations`
Lists conversations belonging to the authenticated user.

**Response (`200 OK`):**
```json
{
  "conversations": [
    {
      "_id": "67191ab234cd56ef78901234",
      "title": "Email Summary & Tasks",
      "updatedAt": "2026-10-23T16:00:00.000Z",
      "createdAt": "2026-10-23T15:45:00.000Z"
    }
  ]
}
```

---

### `GET /chat/conversations/:id`
Retrieves message history for a specific conversation.

**Response (`200 OK`):**
```json
{
  "conversation": {
    "_id": "67191ab234cd56ef78901234",
    "title": "Email Summary & Tasks",
    "messages": [
      {
        "sender": "user",
        "text": "Summarize my unread emails",
        "createdAt": "2026-10-23T15:45:10.000Z"
      },
      {
        "sender": "assistant",
        "text": "Here is a summary of your recent unread emails: ...",
        "createdAt": "2026-10-23T15:45:15.000Z"
      }
    ]
  }
}
```

---

### `DELETE /chat/conversations/:id`
Deletes a conversation and all its messages.

**Response (`200 OK`):**
```json
{
  "message": "Conversation deleted successfully."
}
```

---

### `POST /chat`
Submits a user prompt, retrieves conversation context and decrypted credentials, invokes the Python agent runtime, and returns the generated answer.

**Request Body:**
```json
{
  "conversationId": "67191ab234cd56ef78901234",
  "message": "Find phone number for Vivek Patil"
}
```

**Response (`200 OK`):**
```json
{
  "conversationId": "67191ab234cd56ef78901234",
  "reply": "I found 1 contact matching 'Vivek Patil': Phone: +1-555-0199, Email: vivek@example.com."
}
```

---

## 4. Internal Python Agent Service Endpoints (FastAPI)

These endpoints run on the internal Python agent service (`http://127.0.0.1:8000` or internal Render service).

### `GET /health`
Verifies agent service health and model configuration.

**Response (`200 OK`):**
```json
{
  "status": "ok",
  "service": "personal-ai-agent-engine",
  "model": "openai/gpt-oss-120b"
}
```

---

### `GET /capabilities`
Lists supported tools, intents, and execution requirements.

**Response (`200 OK`):**
```json
{
  "status": "ok",
  "model": "openai/gpt-oss-120b",
  "intents": ["gmail", "contacts", "general"],
  "tools": [
    "list_recent_emails",
    "search_emails",
    "summarize_emails_with_ai",
    "search_contacts",
    "list_contacts",
    "add_contact"
  ],
  "context_injection_supported": true
}
```

---

### `POST /invoke`
Executes the LangGraph pipeline with per-request dynamic Google credential injection.

**Headers:**
- `X-Agent-Secret`: Pre-shared service secret.

**Request Body:**
```json
{
  "prompt": "Find phone number for Vivek Patil",
  "history": [
    { "sender": "user", "text": "Hi" },
    { "sender": "assistant", "text": "Hello! How can I assist you?" }
  ],
  "google_tokens": {
    "token": "ya29.a0AfH6...",
    "refresh_token": "1//04...",
    "token_uri": "https://oauth2.googleapis.com/token",
    "client_id": "...",
    "client_secret": "...",
    "scopes": ["https://www.googleapis.com/auth/contacts"]
  }
}
```

**Response (`200 OK`):**
```json
{
  "reply": "I found Vivek Patil's contact: ...",
  "intent": "contacts",
  "tokens_refreshed": false
}
```
