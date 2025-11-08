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
