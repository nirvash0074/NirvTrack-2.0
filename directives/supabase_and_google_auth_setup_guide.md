# SOP: Supabase PostgreSQL Database & Google OAuth 2.0 Setup Guide
**Directive Code**: `directives/supabase_and_google_auth_setup_guide.md`  
**Version**: `2.0.20261023.105`  
**Application**: NirvTrack 2.0  
**Security Standard**: Declarative Multi-Tenant Row-Level Security (RLS) + OAuth 2.0 PKCE  

---

## 1. Architecture Overview
NirvTrack 2.0 uses a **local-first, cloud-synchronized architecture**:
- **Offline / Local Guarantee**: The app never blocks UI interactions. You can track budgets, record expenses, and run financial analytics 100% offline with 0ms latency.
- **Cloud Persistence**: [Supabase](https://supabase.com) provides managed PostgreSQL with Row-Level Security (RLS) data isolation.
- **Authentication**: Native Google OAuth 2.0 Single Sign-On (SSO) via Supabase Auth (GoTrue) using PKCE flow.
- **Auto-Migration**: First-time Google sign-ins automatically migrate existing local storage financial data into PostgreSQL. Subsequent saves debounce (1500ms) and sync seamlessly in the background.

```
┌────────────────────────────────────────────────────────┐
│                      NirvTrack 2.0                     │
│               Local Workstation (Browser)              │
│  ┌───────────────────────┐   ┌──────────────────────┐  │
│  │ Local Storage Cache   │◄──┤ appState Store       │  │
│  │ (Instant 0ms latency) │   │ (50/30/20 & Surplus) │  │
│  └───────────────────────┘   └──────────┬───────────┘  │
└─────────────────────────────────────────┼──────────────┘
                                          │ Background Sync
                                          ▼ (Debounced WAL)
┌────────────────────────────────────────────────────────┐
│                   Supabase Cloud                       │
│  ┌───────────────────────┐   ┌──────────────────────┐  │
│  │ GoTrue Auth           │   │ PostgreSQL Database  │  │
│  │ (Google OAuth 2.0)    │──►│ (10 Tables with RLS) │  │
│  └───────────────────────┘   └──────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Step-by-Step Setup Instructions

### Step 1: Create a Free Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and sign in or sign up.
2. Click **New Project**.
3. Choose an organization, enter a project name (e.g., `NirvTrack-DB`), create a secure database password, and select your preferred region (e.g., *Singapore*, *US East*, etc.).
4. Click **Create new project** and wait ~1–2 minutes for the database to provision.

---

### Step 2: Deploy the Database Schema
1. In your Supabase Dashboard, click **SQL Editor** in the left sidebar (or press `Ctrl + /`).
2. Click **New query**.
3. Open [`supabase/schema.sql`](../supabase/schema.sql) in this repository, copy its entire contents, and paste it into the Supabase SQL Editor.
4. Click **Run** (green button).
5. Verify success: Open **Table Editor** on the left menu. You should see all 11 tables created with RLS enabled:
   - `users`, `workspaces`, `categories`, `budgets`, `incomes`, `expenses`
   - `recurring_bills`, `sinking_funds`, `wallets`, `planned_expenses`, `audit_logs`

---

### Step 3: Configure Google OAuth in Google Cloud Console
To enable Google Sign-In with your own Google account or multiple users:

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create or select a project (e.g. `NirvTrack`).
3. **Configure OAuth Consent Screen** (if not already configured):
   - Go to **APIs & Services** -> **OAuth consent screen**.
   - User Type: Select **External** (or **Internal** if using Google Workspace).
   - App name: `NirvTrack 2.0`.
   - User support email: Your email.
   - Developer contact email: Your email.
   - Click **Save and Continue** through Scopes (default `email`, `profile`, `openid` are all you need).
   - In **Test users**, add your own Google email address if the app publishing status is in *Testing*.
4. **Create OAuth Client ID**:
   - Go to **APIs & Services** -> **Credentials**.
   - Click **+ CREATE CREDENTIALS** -> **OAuth client ID**.
   - Application type: **Web application**.
   - Name: `NirvTrack Web Client`.
   - **Authorized JavaScript origins**:
     - `http://localhost:7777`
     - `http://localhost:7788`
     - *(Add your custom production domain if deployed online, e.g. `https://your-domain.com`)*
   - **Authorized redirect URIs**:
     - `https://jftyzfdmlkagyhxbrqab.supabase.co/auth/v1/callback`
   - Click **Create**.
   - Copy your **Client ID** and **Client Secret**.

---

### Step 4: Enable Google Provider in Supabase Auth
1. In your [Supabase Dashboard](https://supabase.com/dashboard/project/jftyzfdmlkagyhxbrqab/auth/providers), navigate to **Authentication** -> **Providers**.
2. Click on **Google** to expand its configuration.
3. Toggle **Enable Sign in with Google** to ON.
4. Paste your **Client ID** (from Step 3).
5. Paste your **Client Secret** (from Step 3).
6. Under **Authorized Client IDs** (optional), you can leave blank.
7. Click **Save**.

---

### Step 5: Pre-configured Credentials
Your NirvTrack 2.0 instance is already pre-configured out-of-the-box with your project:
- **Project URL**: `https://jftyzfdmlkagyhxbrqab.supabase.co`
- **anon public API Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

### Step 6: Connect & Test in NirvTrack 2.0
1. Launch NirvTrack 2.0 locally:
   - Double-click `start-app.bat` or run `./start-app.ps1`.
   - Opens `http://localhost:7777` in your browser.
2. In the top-right header, click **☁️ Sign In**.
3. (Optional) Click **⚙️ Configure Supabase Credentials** to verify your URL and Anon Key are active.
4. Click **Continue with Google**!
   - You will be redirected to Google to approve access.
   - Upon return, you will see your Google profile photo, your name, and your status set to **Executive Tier**.
   - Any transactions or budgets entered locally will automatically sync to your PostgreSQL database!

---

## 3. Verification & Testing Checklist
- [x] Schema tables and RLS policies created in Supabase SQL editor.
- [x] Topbar shows **☁️ Sign In** when unauthenticated, and user profile badge with 👑 when authenticated.
- [x] Clicking **Continue with Google** authenticates without error and updates header profile.
- [x] Adding a transaction in NirvTrack shows `🟢 Cloud Synced` and creates a row in the Supabase `expenses` table.
- [x] Signing out returns to Local Offline Mode without blocking the UI.
- [x] Automated feature regression audit passes with 100%: `& "C:\Program Files\nodejs\node.exe" "execution/run_full_audit.js"`.
