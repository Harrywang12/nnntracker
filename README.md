# Adult Content Tracker (WebExtension)

Cross-browser browser extension that tracks visits to adult content websites, shows a calendar with your clean streak, blocks adult content sites, and sends a browser notification when your streak breaks. Works on Chrome, Firefox, and Edge.

## Quick Start

1. **Download the extension:**
   - Click the green "Code" button on GitHub → "Download ZIP"
   - Or clone: `git clone https://github.com/YOUR_USERNAME/nnntracker.git`

2. **Install the extension:**
   - See installation instructions below
   - **No setup required!** The extension uses a shared Supabase backend for login/leaderboard features
   - Just install and start using it - sign up/login works immediately

3. **Optional: Use your own Supabase instance:**
   - If you want your own private backend, see "Custom Supabase Setup" below
   - Create `popup/config.js` with your own credentials to override the shared instance

## Features
- **Blocks adult content websites** - Automatically blocks sites matching keywords or your custom list
- Detects adult content visits by keyword in the domain and via custom site list
- Popup shows current streak and a monthly calendar
- Browser notification on every detection
- Manage your own flagged websites list
- Optional account login (email/password) to sync progress
- Leaderboard of most detections (requires login and Supabase backend)
- Username system for leaderboard display

## Install (Chrome / Edge - Manifest V3)
1. Download or clone this folder.
2. Open the browser and navigate to:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. Enable "Developer mode".
4. Click "Load unpacked" and select this folder (`nnntracker`).
5. Pin the extension and click the icon to open the popup.

## Install (Firefox - Manifest V3)
1. Open `about:debugging#/runtime/this-firefox`.
2. Click "Load Temporary Add-on".
3. Select the `manifest.json` in this folder.
4. Click the toolbar icon to open the popup.

## How it works
- Background service worker listens to top-level navigations (`webNavigation.onCommitted`).
- If the domain contains adult keywords or matches your custom list, it records the date and fires a notification.
- Streak is computed as the number of days since the last visit date.
- The popup renders a calendar and highlights clean days since the last visit.
- If logged in, detections are also POSTed to the backend, and the Leaderboard tab becomes available.

## Permissions
- `webNavigation`: Detect top-level navigations.
- `storage`: Persist streak data and custom sites.
- `notifications`: Show notification when streak breaks.
- `tabs`: Required by some browsers for navigation URL access.
- `host_permissions` (`<all_urls>`): Ensure cross-browser URL access for detection.

## Notes
- The extension uses a tiny embedded 1×1 PNG for notification icons to keep the package small.
- Data is stored locally using the browser's extension storage; it is not synced or sent anywhere.

## Supabase Backend (Pre-configured)

**The extension comes pre-configured with a shared Supabase backend!**

- **No setup required** - Just install and use
- Login/Signup works immediately
- Leaderboard is shared across all users
- All users can see the global leaderboard

### How it works
- The extension uses `popup/config.js` with pre-configured Supabase credentials
- Login/Signup uses Supabase Auth REST API
- Detections insert into `public.detections` with `user_id`, `email`, `date`
- Leaderboard reads from `public.leaderboard_view` (shows usernames)
- Each user's data is isolated via Row Level Security (RLS) policies

## Custom Supabase Setup (Optional)

If you want your own private Supabase instance instead of the shared one:

1. **Create a Supabase project:**
   - Go to [supabase.com](https://supabase.com) and sign up (free tier available)
   - Create a new project (takes ~2 minutes)

2. **Run database migrations:**
   - In Supabase Dashboard → SQL Editor
   - Run `supabase/migrations/001_initial_schema.sql` (creates tables and policies)
   - If you want username support, also run `002_add_username.sql` and `003_update_leaderboard_username.sql`
   - Run `004_ensure_rls_policies.sql` to ensure RLS is enabled and baseline policies exist
   - (Recommended) Run `005_security_hardening.sql` for triggers/constraints that enforce user-owned rows and prevent abuse

3. **Configure authentication:**
   - Go to Authentication → Providers
   - Enable "Email" provider
   - Go to Authentication → Settings
   - **Disable "Enable email confirmations"** (optional, allows instant login after signup)

4. **Get your API credentials:**
   - Go to Project Settings → API
   - Copy your **Project URL** (looks like `https://xxxxx.supabase.co`)
   - Copy your **anon public** key (long JWT token)

5. **Configure the extension:**
   - Copy `popup/config.example.js` to `popup/config.js`
   - Paste your Supabase URL and anon key into `config.js`
   - 
   - **Note:** `config.js` is in `.gitignore` - your credentials stay private!

6. **Reload the extension** and you're using your own private backend!

## Privacy & Security
- **Shared instance:** All users share the same leaderboard, but each user's account data is isolated via RLS
- **Custom instance:** Your credentials are stored locally in `popup/config.js` (not committed to git)
- The extension works fully offline for local tracking (login/leaderboard optional)

## User Test Checklist (10 minutes)
- Install extension (load unpacked or temporary add-on)
- Account
  - Sign up (auto-login if email confirmations disabled)
  - Log out and log back in
  - Set a username; verify it appears in Leaderboard
- Detection & Blocking
  - Add a custom domain (e.g., `example.com`) and verify it is blocked immediately
  - Visit a keyword domain (contains `porn`/`xxx`) → should block and notify
  - Check streak resets in the popup
- Leaderboard
  - Refresh Leaderboard; verify your username and detection count update

## Troubleshooting
- "Supabase not configured (popup/config.js)"
  - Ensure `popup/config.js` is present with your Supabase credentials
- "Email not confirmed" error on login
  - Disable email confirmations in Supabase auth settings or confirm the email once
- Blocking doesn't work
  - Ensure "Allow access to URLs" is enabled for the extension
  - Reload the extension after changing custom sites
- Detections not appearing in Leaderboard
  - Verify migrations ran, especially `leaderboard_view` and RLS migrations
  - Confirm you are logged in; Leaderboard requires auth



