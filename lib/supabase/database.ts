import "server-only";

import { Pool } from "pg";

declare global {
  var __pmAjaySupabasePool: Pool | undefined;
}

export function hasSupabaseDatabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_PASSWORD,
  );
}

function createPool() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const password = process.env.SUPABASE_PASSWORD;

  if (!supabaseUrl || !password) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_PASSWORD.",
    );
  }

  const projectReference = new URL(supabaseUrl).hostname.split(".")[0];

  return new Pool({
    host:
      process.env.SUPABASE_DB_HOST ||
      "aws-0-ap-southeast-1.pooler.supabase.com",
    port: Number(process.env.SUPABASE_DB_PORT || 5432),
    user: process.env.SUPABASE_DB_USER || `postgres.${projectReference}`,
    password,
    database: process.env.SUPABASE_DB_NAME || "postgres",
    // Supabase's pooler currently presents a chain that Node cannot validate.
    // Traffic remains encrypted; certificate verification is disabled only here.
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 30_000,
    allowExitOnIdle: true,
  });
}

export function getSupabasePool() {
  if (!globalThis.__pmAjaySupabasePool) {
    globalThis.__pmAjaySupabasePool = createPool();
  }
  return globalThis.__pmAjaySupabasePool;
}
