Supabase Setup for Adult Content Tracker
=======================================

This folder contains SQL to create the required schema on Supabase.

Steps
-----
1. Create a new Supabase project.
2. In the SQL editor, run `migrations/001_initial_schema.sql`.
3. In Authentication → Providers, enable Email/Password (and confirm settings).
4. **Disable Email Verification** (optional but recommended):
   - Go to Authentication → Settings
   - Under "Email Auth", toggle OFF "Enable email confirmations"
   - This allows users to sign up and immediately log in without email verification
5. Get your project URL and `anon` public key from Project Settings → API.
6. In the extension, copy `popup/config.example.js` to `popup/config.js` and set:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
7. Reload the extension in your browser.

Notes
-----
- The extension stores detections with `user_id`, `email`, and `date`.
- Leaderboard reads from `public.leaderboard_view`, which aggregates by email.
- RLS policies allow authenticated users to insert their own rows and select for the leaderboard.
- For production, consider using a dedicated `profiles` table and restricting what is exposed.


