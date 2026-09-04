# Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. SQL Editor → paste and run `schema.sql`.
3. Authentication → Providers → enable **Google**.
   - Google Cloud Console: create OAuth client (Web).
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Paste Client ID and Secret into Supabase.
4. Authentication → URL configuration:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`
5. Copy Project URL and anon/publishable key into `.env.local`.
