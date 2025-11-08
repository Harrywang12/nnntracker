# GitHub Setup Instructions

## Push to GitHub

1. **Create a new repository on GitHub:**
   - Go to [github.com](https://github.com) and sign in
   - Click the "+" icon → "New repository"
   - Name it `nnntracker` (or any name you want)
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
   - Click "Create repository"

2. **Push your code to GitHub:**
   ```bash
   # Add the remote (replace YOUR_USERNAME with your GitHub username)
   git remote add origin https://github.com/YOUR_USERNAME/nnntracker.git
   
   # Push to GitHub
   git push -u origin main
   ```

3. **Verify your shared config is included:**
   - Go to your GitHub repo
   - Check that `popup/config.shared.js` **IS** in the file list (this contains your Supabase credentials)
   - Check that `popup/config.js` is **NOT** in the file list (users can create this to override)
   - Your shared Supabase instance is ready for all users! ✅

## Making it Public

If you want others to download and use your extension:

1. Go to your repository settings
2. Scroll down to "Danger Zone"
3. Click "Change visibility" → "Make public"
4. Now anyone can:
   - Download the ZIP
   - Clone the repository
   - Use the extension

## Distribution Options

### Option 1: Direct Download (Easiest)
- Users download ZIP from GitHub
- Extract and install as unpacked extension
- Each user sets up their own Supabase instance

### Option 2: Chrome Web Store (Future)
- Package the extension as a `.zip`
- Submit to Chrome Web Store
- Users can install with one click
- Note: Requires developer account ($5 one-time fee)

### Option 3: Firefox Add-ons (Future)
- Package the extension
- Submit to Firefox Add-ons (AMO)
- Free to publish

## Important Notes

✅ **Shared Supabase instance:**
- `popup/config.shared.js` contains your Supabase credentials (committed to git)
- All users will use your shared Supabase instance
- Users can override by creating their own `popup/config.js` (in `.gitignore`)
- Leaderboard is shared across all users

✅ **Users just need to:**
1. Download/clone your repo
2. Install the extension (no setup required!)
3. Sign up/login works immediately
4. Leaderboard is pre-configured

**Optional:** Users can create their own `popup/config.js` to use a private Supabase instance instead

