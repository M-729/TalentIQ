# Google Calendar / Meet Integration — Setup

This backend can create a Google Calendar event (with a Google Meet link) for a scheduled Interview, on behalf of the connecting HR/Admin user's own Google account. This document explains how to configure a Google Cloud project for it. It contains no real credentials — only setup steps and the **names** of the environment variables you need to fill in locally.

## 1. Enable the Calendar API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and select or create a project for TalentIQ.
2. Navigate to **APIs & Services > Library**.
3. Search for **Google Calendar API** and click **Enable**.

## 2. Configure the OAuth consent screen

1. Navigate to **APIs & Services > OAuth consent screen**.
2. Choose **External** (or **Internal** if your Google Workspace organization restricts this app to its own users) and fill in the required app details (app name, support email).
3. Under **Scopes**, add exactly the scopes this integration requests (see [Scopes](#4-scopes-requested) below) — do not add broader Calendar, Gmail, or Drive scopes.
4. While the app is in **Testing** mode, add every Google account that will connect (e.g. your own HR/Admin test accounts) as a **Test user** — Google will otherwise refuse to authorize them.

## 3. Create OAuth 2.0 credentials (Web application)

1. Navigate to **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
2. Choose **Web application** as the application type.
3. Under **Authorized redirect URIs**, add the exact callback URL this backend will use (see [Redirect URI](#5-redirect-uri) below).
4. Save. Google shows you a **Client ID** and **Client secret** — copy these into your local, gitignored `.env` file (never into `.env.example`).

## 4. Scopes requested

This integration requests exactly the following OAuth scopes, and nothing broader:

- `https://www.googleapis.com/auth/calendar.events` — the minimum practical scope for creating, updating, and deleting Calendar events. Deliberately **not** the broad `calendar` scope (which grants full read/write/manage access to every calendar the account owns).
- `openid`
- `https://www.googleapis.com/auth/userinfo.email`

The `openid` and `userinfo.email` scopes are the minimal addition needed to learn **which** Google account connected — the connected `google_account_email` is what lets HR tell which of several connected accounts owns a given Interview's Calendar event (surfaced via the `/status` endpoint and the Interview's `calendar` field). No Gmail, Drive, or full-profile scope is ever requested.

## 5. Redirect URI

The backend's OAuth callback is:

```
GET /api/v1/integrations/google-calendar/callback
```

Register the **full** URL (scheme + host + path) as an Authorized redirect URI in your OAuth client, matching whatever you set `GOOGLE_REDIRECT_URI` to.

- **Local development example**: `http://localhost:4000/api/v1/integrations/google-calendar/callback`
- **Production example**: `https://api.yourdomain.com/api/v1/integrations/google-calendar/callback`

The value must match **exactly** (including scheme and trailing slashes) between the Google Cloud Console configuration and your `GOOGLE_REDIRECT_URI` environment variable, or Google will reject the exchange.

## 6. Required environment variables

Set these in your local, gitignored `.env` (see `backend/.env.example` for the placeholder entries — never put real values there):

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client ID from step 3. |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret from step 3. **Real secret** — local `.env` only. |
| `GOOGLE_REDIRECT_URI` | The exact callback URL registered in step 5. |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | A base64-encoded 32-byte key used to encrypt stored Google refresh tokens at rest (AES-256-GCM). **Real secret** — local `.env` only. Generate one with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `FRONTEND_URL` | Not a secret. Where the OAuth callback redirects the browser after success/failure (e.g. `http://localhost:5173`). |

All five are optional at boot — the backend (and its full test suite, which mocks the Google provider entirely) runs fine without them configured. Attempting an actual OAuth connect/callback or a real Calendar API call while any of the Google-specific ones are unset fails with a clear runtime error at the point of use, rather than booting into a broken state.

## 7. Reconnect behavior (no new refresh token)

Google only issues a refresh token on the **first** consent for a given user/app pair, or when the consent screen is shown again with `prompt=consent` (which this integration always requests). If a user reconnects and Google's response happens to omit a refresh token, the backend does **not** overwrite the existing stored refresh token with nothing — the previously stored, still-valid token is kept, and only the connection's other metadata (account email, granted scopes, connected_at) is refreshed. A genuinely first-time connect that receives no refresh token at all fails outright, since there would be nothing usable to store.

## 8. What this integration does not do (yet)

- It does not send its own email invitation — Google's own `sendUpdates=all` notification to attendees is the only interview-invitation email sent by this integration.
- It does not support Outlook/Microsoft Calendar, Zoom, or Microsoft Teams.
- It never auto-schedules an Interview or auto-creates a Calendar event — creating/syncing a Calendar event for an Interview is always an explicit action.
