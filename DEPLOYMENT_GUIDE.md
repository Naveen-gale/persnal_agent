# Personal AI Agent - Production Deployment Guide

A step-by-step operational guide for running the Personal AI Agent locally and deploying it 24/7 to the cloud across **Render** (Node.js API & Python Agent), **MongoDB Atlas** (Database), and **Vercel** (React Frontend).

---

## 1. Prerequisites Checklist

| Component | Provider | Purpose | Free Tier Available |
|---|---|---|:---:|
| **Database** | [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) | Stores users, message history & encrypted OAuth tokens | Yes (M0 Free Cluster) |
| **LLM Inference** | [Groq Cloud](https://console.groq.com) | High-speed LLM inference (`openai/gpt-oss-120b`) | Yes |
| **OAuth & APIs** | [Google Cloud Console](https://console.cloud.google.com) | Gmail & Contacts API credentials | Yes |
| **Python Agent** | [Render](https://render.com) | Runs FastAPI + LangGraph Agent microservice | Yes |
| **Backend API** | [Render](https://render.com) | Runs Express orchestrator + AES-256-GCM encryption | Yes |
| **Frontend** | [Vercel](https://vercel.com) | Hosts modern React + Vite dashboard | Yes |

---

## 2. Google Cloud Console Setup

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create a project (e.g. `personal-ai-agent`).
2. Navigate to **APIs & Services > Library** and enable:
   - **Gmail API**
   - **People API** (Google Contacts)
3. Navigate to **APIs & Services > OAuth consent screen**:
   - User Type: **External**.
   - App Name: `Personal AI Agent`.
   - Add your Gmail as a **Test User**.
   - Add scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/contacts`
     - `https://www.googleapis.com/auth/userinfo.email`
4. Navigate to **APIs & Services > Credentials > Create Credentials > OAuth client ID**:
   - Application type: **Web application**.
   - Name: `Personal AI Agent Web Client`.
   - **Authorized JavaScript origins**:
     - `http://localhost:5173`
     - `https://your-agent-frontend.vercel.app`
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/v1/integrations/google/callback`
     - `https://your-agent-backend.onrender.com/api/v1/integrations/google/callback`
5. Note your **Client ID** and **Client Secret**.

---

## 3. MongoDB Atlas Database Setup

1. Create a free **M0 Cluster** in MongoDB Atlas.
2. Under **Database Access**, create a database user (e.g. `agent_admin`) with password.
3. Under **Network Access**, click **Add IP Address** and choose **Allow Access from Anywhere** (`0.0.0.0/0`) so Render instances can connect.
4. Click **Connect > Drivers > Node.js** and copy your connection string:
   ```
   mongodb+srv://agent_admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

---

## 4. Local Development Walkthrough (PowerShell)

To run the entire full-stack application on your local machine:

### Terminal 1: Python LangGraph Agent (Port 8000)
```powershell
cd c:\Users\galen\Desktop\agent\personal-agent\agent
..\..\.venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```
*Health check:* Open `http://127.0.0.1:8000/health` in your browser.

### Terminal 2: Express Backend API (Port 3000)
```powershell
cd c:\Users\galen\Desktop\agent\backend
npm run dev
```
*Health check:* Open `http://localhost:3000/health` in your browser.

### Terminal 3: React Frontend (Port 5173)
```powershell
cd c:\Users\galen\Desktop\agent\frontend
npm run dev
```
*Dashboard:* Open `http://localhost:5173` in your browser.

---

## 5. Cloud Deployment Guide (24/7 Online)

### Step 5.1: Deploy Python Agent Service on Render

1. Push your repository to GitHub.
2. In Render dashboard, click **New > Web Service**.
3. Connect your GitHub repository.
4. Set configurations:
   - **Name:** `personal-agent-python`
   - **Root Directory:** `personal-agent/agent`
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
5. Add **Environment Variables**:
   | Variable | Value | Description |
   |---|---|---|
   | `GROQ_API_KEY` | `gsk_...` | Your Groq API key |
   | `GROQ_MODEL` | `openai/gpt-oss-120b` | Groq model identifier |
   | `AGENT_SERVICE_SECRET` | `generate-a-strong-32char-secret` | Shared secret with Express |
6. Click **Deploy**. Note the internal or public URL: `https://personal-agent-python.onrender.com`.

---

### Step 5.2: Deploy Express Backend on Render

1. In Render dashboard, click **New > Web Service**.
2. Connect your GitHub repository.
3. Set configurations:
   - **Name:** `personal-agent-backend`
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add **Environment Variables**:
   | Variable | Value | Description |
   |---|---|---|
   | `NODE_ENV` | `production` | Production mode |
   | `FRONTEND_URL` | `https://your-agent.vercel.app` | Vercel domain |
   | `BACKEND_PUBLIC_URL` | `https://personal-agent-backend.onrender.com` | This Render URL |
   | `MONGODB_URI` | `mongodb+srv://...` | Atlas connection string |
   | `SESSION_SECRET` | `generate-random-32char-string` | JWT signing secret |
   | `GOOGLE_TOKEN_ENCRYPTION_KEY` | `generate-random-32char-string` | AES-256-GCM encryption key |
   | `GOOGLE_CLIENT_ID` | `...apps.googleusercontent.com` | From Google Cloud |
   | `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | From Google Cloud |
   | `GOOGLE_REDIRECT_URI` | `https://personal-agent-backend.onrender.com/api/v1/integrations/google/callback` | OAuth redirect target |
   | `AGENT_BASE_URL` | `https://personal-agent-python.onrender.com` | Python agent URL |
   | `AGENT_SERVICE_SECRET` | `same-32char-secret-as-python-agent` | Shared secret |
5. Click **Deploy**.

---

### Step 5.3: Deploy React Frontend on Vercel

1. Log in to [Vercel](https://vercel.com) and click **Add New > Project**.
2. Import your GitHub repository.
3. Configure project settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click Edit and select `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add **Environment Variable**:
   | Variable | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://personal-agent-backend.onrender.com/api/v1` |
5. Click **Deploy**.

---

## 6. Verification Checklist

1. **Access App:** Open your Vercel URL `https://your-agent.vercel.app` from your phone or laptop.
2. **Account Creation:** Register your master account (`name`, `email`, `password`).
3. **Google Authorization:** In the dashboard, click **Connect Google Account**.
   - Complete Google consent once.
   - Verify that status updates to **Connected** with your Gmail address.
4. **Tool Verification:**
   - Ask: `"Summarize my unread emails"` $\rightarrow$ Agent calls Gmail API and returns structured bullet points.
   - Ask: `"Find contact Vivek Patil"` $\rightarrow$ Agent queries Contacts API and returns matching numbers.
   - Ask: `"Add contact Naveen 9164490879"` $\rightarrow$ Agent creates contact in Google Contacts.
5. **Cross-Device Persistence:** Turn off your computer, open the website on another device (phone/tablet), sign in with your email/password. Verify that Google integration remains **Connected** without re-prompting.

---

## 7. Troubleshooting

### 7.1. Error 400: `redirect_uri_mismatch`
- **Cause:** The redirect URI in Google Cloud Console does not match `GOOGLE_REDIRECT_URI`.
- **Fix:** Ensure both `http://localhost:3000/api/v1/integrations/google/callback` (for local) and `https://<backend>.onrender.com/api/v1/integrations/google/callback` (for Render) are added to **Authorized redirect URIs** in Google Cloud Console.

### 7.2. Cookies Not Saved on Safari or Mobile Chrome
- **Cause:** Third-party cookie blocking across different domains (`.vercel.app` vs `.onrender.com`).
- **Fix:** The frontend automatically persists the JWT token to `localStorage` and includes `Authorization: Bearer <token>` on all requests as a fallback.

### 7.3. MongoDB Connection Timeout
- **Cause:** Atlas IP Allowlist is blocking Render's IP addresses.
- **Fix:** In MongoDB Atlas > Network Access, add `0.0.0.0/0` (Allow access from anywhere).

### 7.4. Python Agent 401 Unauthorized
- **Cause:** `AGENT_SERVICE_SECRET` in Express backend does not match `AGENT_SERVICE_SECRET` in Python agent.
- **Fix:** Copy the exact secret between both services in Render's Environment settings.
