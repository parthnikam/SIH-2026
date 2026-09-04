# Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. SQL Editor → paste and run `schema.sql`.
   For a database created with the older Google-auth schema, run
   `migrations/20260905_remove_google_auth.sql` instead.
3. Copy the Project URL and database password into `.env.local` as
   `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_PASSWORD`.
4. If your project is not in Southeast Asia, also set the pooler host shown in
   Supabase → Connect as `SUPABASE_DB_HOST`.

The app uses the server-only Supabase Postgres connection. Google OAuth,
Supabase Auth providers, and a browser-exposed anon key are not required.
