# Adult Content Tracker (WebExtension)

Cross-browser browser extension that tracks visits to adult content websites, shows a calendar with your clean streak, blocks adult content sites, and sends a browser notification when your streak breaks. Works on Chrome, Firefox, and Edge.

## Quick Start

1. **Download the extension:**
   - Click the green "Code" button on GitHub → "Download ZIP"
   - Or clone: `git clone https://github.com/YOUR_USERNAME/nnntracker.git`

2. **Set up your Supabase backend (optional, for login/leaderboard):**
   - Create a free account at [supabase.com](https://supabase.com)
   - Create a new project
   - Run the SQL migrations in `supabase/migrations/` (see Setup below)
   - Copy `popup/config.example.js` to `popup/config.js` and add your Supabase credentials

3. **Install the extension:**
   - See installation instructions below

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

## Supabase Backend Setup (for Login/Leaderboard)

**Note:** Each user needs their own Supabase project. Your credentials are stored locally and never shared.

### Setup Steps
1. **Create a Supabase project:**
   - Go to [supabase.com](https://supabase.com) and sign up (free tier available)
   - Create a new project (takes ~2 minutes)

2. **Run database migrations:**
   - In Supabase Dashboard → SQL Editor
   - Run `supabase/migrations/001_initial_schema.sql` (creates tables and policies)
   - If you want username support, also run `002_add_username.sql` and `003_update_leaderboard_username.sql`

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
   - **Important:** `config.js` is in `.gitignore` - your credentials stay private!

6. **Reload the extension** and you're ready to use login/leaderboard features!

### How it works
- Login/Signup uses Supabase Auth REST API
- Detections insert into `public.detections` with `user_id`, `email`, `date`
- Leaderboard reads from `public.leaderboard_view` (shows usernames)
- Each user's data is isolated via Row Level Security (RLS) policies

## Privacy & Security
- Your Supabase credentials are stored locally in `popup/config.js` (not committed to git)
- Each user sets up their own Supabase instance - no shared backend
- All data is stored in your own Supabase project
- The extension works fully offline for local tracking (login/leaderboard optional)



