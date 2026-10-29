# Personal AI Agent — Production Deployment Guide

This guide covers deploying the Personal AI Agent stack:
1. **Render**: Python LangGraph Agent & Node.js API Backend
2. **Vercel**: React (Vite) Frontend
3. **Google Cloud Console**: OAuth 2.0 setup configured for **All Users** (Public / External)

> **Note:** Database (MongoDB Atlas) setup is already completed. Have your MongoDB connection string ready for the backend environment variables.

---

## Deployment Flow Overview

```
Step 1: Deploy Render Services  ───►  Get Backend URL (https://xxxx.onrender.com)
            │
Step 2: Deploy Vercel Frontend  ───►  Get Frontend URL (https://xxxx.vercel.app)
            │                         (Update FRONTEND_URL in Render)
            ▼
Step 3: Google Cloud Console   ───►  Set Authorized Origin & Redirect URI
        (Configured for ALL Users)    Add Client ID & Secret to Render
```

---

## Step 1: Deploy on Render

Render will host two web services:
- **Python Agent** (LangGraph workflow + Groq LLM inference)
- **Node.js Backend** (Express API, OAuth handling, sessions, token encryption)

Deploy the **Python Agent first** so its URL is ready for the Node.js backend.

---

### 1.1 Deploy Python LangGraph Agent

1. Log in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** > **Web Service**.
3. Connect your GitHub repository.
4. Configure the service settings:
   - **Name:** `personal-agent-python`
   - **Region:** Choose the region closest to you (e.g., Frankfurt, Ohio, Oregon, Singapore)
   - **Branch:** `main`
   - **Root Directory:** `personal-agent/agent`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python server.py`
   - **Instance Type:** `Free`

5. Under **Environment Variables**, add:

   | Key | Example / Recommended Value | Description |
   |---|---|---|
   | `GROQ_API_KEY` | `gsk_...` | Your Groq Cloud API Key |
   | `GROQ_MODEL` | `openai/gpt-oss-120b` | LLM model identifier |
   | `AGENT_SERVICE_SECRET` | `4f8a9e2c1b7d5e6f3a0b8c4d2e1f9a7b` | Random 32+ char secret string (must match backend) |
   | `AGENT_HOST` | `0.0.0.0` | Host binding interface |

6. Click **Create Web Service**.
7. Wait for the build to finish. Copy your Python agent URL:
   `https://personal-agent-python.onrender.com`
8. **Verify:** Open `https://personal-agent-python.onrender.com/health` in your browser. It should return:
   ```json
   {"status":"ok","service":"personal-ai-agent","model":"openai/gpt-oss-120b"}
   ```

---

### 1.2 Deploy Node.js Express Backend

1. In Render Dashboard, click **New +** > **Web Service**.
2. Connect the same GitHub repository.
3. Configure the service settings:
   - **Name:** `personal-agent-backend`
   - **Region:** Same region as Python service
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`

4. Under **Environment Variables**, add:

   | Key | Value / Example | Notes |
   |---|---|---|
   | `NODE_ENV` | `production` | Production mode |
   | `PORT` | `3000` | Port (*Render auto-injects `PORT`*) |
   | `MONGODB_URI` | `mongodb+srv://...` | Your existing MongoDB connection string |
   | `MONGODB_DB_NAME` | `personal_agent` | MongoDB database name |
   | `SESSION_SECRET` | *(generate random 32+ characters)* | JWT signing secret |
   | `COOKIE_NAME` | `agent_token` | Session cookie name |
   | `SESSION_MAX_AGE_MS` | `604800000` | 7 days in milliseconds |
   | `GOOGLE_TOKEN_ENCRYPTION_KEY` | *(generate exact 32 characters)* | AES-256-GCM encryption key |
   | `AGENT_BASE_URL` | `https://personal-agent-python.onrender.com` | Python agent URL from Step 1.1 |
   | `AGENT_SERVICE_SECRET` | `4f8a9e2c1b7d5e6f3a0b8c4d2e1f9a7b` | Must match secret in Python agent |
   | `BACKEND_PUBLIC_URL` | `https://personal-agent-backend.onrender.com` | Your Render backend public URL |
   | `FRONTEND_URL` | `https://agent.vercel.app` | Temporary placeholder (will update in Step 2) |
   | `GOOGLE_REDIRECT_URI` | `https://personal-agent-backend.onrender.com/api/v1/integrations/google/callback` | OAuth callback target URL |
   | `GOOGLE_CLIENT_ID` | `placeholder` | Will update in Step 3 |
   | `GOOGLE_CLIENT_SECRET` | `placeholder` | Will update in Step 3 |
   | `IMAGEKIT_PUBLIC_KEY` | `public_...` | (Optional) ImageKit key |
   | `IMAGEKIT_PRIVATE_KEY` | `private_...` | (Optional) ImageKit key |
   | `IMAGEKIT_URL_ENDPOINT` | `https://ik.imagekit.io/...` | (Optional) ImageKit URL |

   > **Generating 32-character secrets:**
   > Run in your local terminal:
   > ```bash
   > node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
   > ```

5. Click **Create Web Service**.
6. Once deployed, copy your backend URL:
   `https://personal-agent-backend.onrender.com`

---

## Step 2: Deploy Frontend on Vercel

The frontend is a React 18 + Vite SPA located in the `frontend` directory.

### 2.1 Import and Configure on Vercel

1. Log in to [Vercel](https://vercel.com).
2. Click **Add New...** > **Project**.
3. Select your GitHub repository.
4. Configure the project:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click **Edit** and select `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

5. Under **Environment Variables**, add:

   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://personal-agent-backend.onrender.com/api/v1` |

   *(Replace with your actual Render backend URL from Step 1.2).*

6. Click **Deploy**.
7. Once deployment finishes, copy your live Vercel domain:
   `https://<your-project>.vercel.app`

---

### 2.2 Link Frontend and Backend (CORS & Session)

Now that you have your live Vercel frontend URL:

1. Go back to your [Render Dashboard](https://dashboard.render.com).
2. Open your **`personal-agent-backend`** service > **Environment**.
3. Update `FRONTEND_URL` with your exact Vercel URL:
   ```env
   FRONTEND_URL=https://<your-project>.vercel.app
   ```
4. Click **Save Changes**. Render will automatically restart the backend service.

---

## Step 3: Google Cloud Console Configuration (For All Users)

Now that both backend and frontend URLs are known, configure Google Cloud Console so **any user with a Google account** can authenticate.

---

### 3.1 Create Project & Enable APIs

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown at the top and select **New Project** (e.g. `personal-ai-agent`).
3. In the search bar or under **APIs & Services > Library**, search for and **Enable** each of these APIs:
   - **Gmail API**
   - **Google People API** (for Contacts)
   - **Google Drive API**
   - **Google Photos Picker API**

---

### 3.2 Configure OAuth Consent Screen for All Users

1. Navigate to **APIs & Services > OAuth consent screen**.
2. **User Type:** Select **External** (this allows ANY Google account to sign in).
3. Click **Create**.

4. **App Information:**
   - **App name:** `Personal AI Agent`
   - **User support email:** Select your email address.
   - **Developer contact information:** Enter your email address.

5. **Authorized Domains:**
   Click **Add Domain** and add:
   - `render.com`
   - `vercel.app`
   *(Also add your custom domain if you use one).*

6. Click **Save and Continue**.

7. **Scopes:**
   Click **Add or Remove Scopes**, filter and select the following scopes:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/contacts`
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`
   - `https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata`
   
   Click **Update** and then **Save and Continue**.

---

### 3.3 Make the Agent Available to All Users (Publish App)

By default, Google puts new external apps in **"Testing"** status, which blocks anyone not manually added to a 100-user limit with `Error 403: access_denied`.

To make the agent accessible to **all users**:

1. Under the **OAuth consent screen** page, find **Publishing status**.
2. Click the **"Publish App"** button.
3. A modal will pop up stating: *"Push to production? Your app will be available to any user with a Google Account."*
4. Click **Confirm**.

> [!IMPORTANT]
> **Handling the "Google hasn't verified this app" Warning Screen:**
>
> Because your app uses sensitive scopes (Gmail, Drive, Contacts) and is published without going through formal Google enterprise verification, Google will display an unverified app screen when users connect their Google account.
>
> **How any user can sign in:**
> 1. When the user clicks **Connect Google**, Google displays: *"Google hasn't verified this app"*.
> 2. The user clicks **"Advanced"** (in small text at the bottom left).
> 3. The user clicks **"Go to Personal AI Agent (unsafe)"**.
> 4. The user selects the required checkboxes to allow Gmail, Drive, and Contacts permissions, then clicks **Continue / Allow**.
>
> All users can authenticate and use the agent without needing to be added as test users.
>
> *(Optional for production verification: If you later wish to remove this warning banner, you can click "Submit for verification" on the OAuth consent screen. This requires a public Privacy Policy URL, Terms of Service URL, and a short YouTube video demonstrating the scopes).*

---

### 3.4 Create OAuth 2.0 Client Credentials

1. Navigate to **APIs & Services > Credentials**.
2. Click **+ Create Credentials** > **OAuth client ID**.
3. **Application type:** Select **Web application**.
4. **Name:** `Personal AI Agent Web Client`.

5. **Authorized JavaScript origins:**
   Click **+ Add URI** and add:
   ```
   https://<your-project>.vercel.app
   http://localhost:5173
   ```
   *(Replace `<your-project>` with your live Vercel subdomain. Keep `localhost` for local testing).*

6. **Authorized redirect URIs:**
   Click **+ Add URI** and add:
   ```
   https://<your-backend>.onrender.com/api/v1/integrations/google/callback
   http://localhost:3000/api/v1/integrations/google/callback
   ```
   *(Replace `<your-backend>` with your live Render backend URL. Ensure there is **no trailing slash**).*

7. Click **Create**.
8. A modal appears displaying your:
   - **Client ID** (e.g. `1234567890-xxx.apps.googleusercontent.com`)
   - **Client Secret** (e.g. `GOCSPX-xxxxxxxxxxxx`)
   Copy both values.

---

### 3.5 Update Render Backend with Google Credentials

1. Go back to your [Render Dashboard](https://dashboard.render.com).
2. Open your **`personal-agent-backend`** service > **Environment**.
3. Update the credentials:
   ```env
   GOOGLE_CLIENT_ID=<your-copied-client-id>
   GOOGLE_CLIENT_SECRET=<your-copied-client-secret>
   ```
4. Click **Save Changes**. Render will automatically redeploy the backend with the new credentials.

---

## Step 4: Verification & End-to-End Test

Once Render finishes redeploying:

1. Open your live Vercel URL: `https://<your-project>.vercel.app`.
2. Register a new account or log in.
3. Click **Connect Google** in the header.
4. You will be redirected to the Google Consent Screen:
   - If prompted with *"Google hasn't verified this app"*, click **Advanced** > **Go to Personal AI Agent (unsafe)**.
   - Check the permission boxes and click **Continue**.
5. You should be redirected back to your frontend dashboard with **Connected** status showing the connected Google email.
6. Test natural language commands in the chat interface:
   - `"Summarize my recent unread emails"`
   - `"Find contact John"`
   - `"List my recent Drive files"`
