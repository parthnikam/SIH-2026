import "server-only";

import { Pool } from "pg";
import { requireAdmin } from "@/lib/admin/auth";
import { normalizeDistrict, normalizeState } from "@/lib/admin/regions";

type DatabaseSession = {
  id: string;
  status: "active" | "completed";
  language: string | null;
  beneficiary: Record<string, unknown> | null;
  started_at: Date | string;
  ended_at: Date | string | null;
  updated_at: Date | string;
  account_name: string | null;
  turn_count: number | string;
  recommendation_count: number | string;
};

export type AdminSession = {
  id: string;
  name: string;
  status: "active" | "completed";
  language: string;
  district: string;
  state: string;
  startedAt: string;
  endedAt: string | null;
  updatedAt: string;
  durationSeconds: number | null;
  turnCount: number;
  recommendationCount: number;
  profileCompletion: number;
};

export type RegionSummary = {
  district: string;
  state: string;
  label: string;
  count: number;
};

export type DashboardData = {
  sessions: AdminSession[];
  regions: RegionSummary[];
  languageCounts: { language: string; count: number }[];
  profileCount: number;
  totalSessions: number;
  completedSessions: number;
  activeSessions: number;
  totalTurns: number;
  totalRecommendations: number;
  identifiedLocations: number;
  averageDurationSeconds: number;
  lastUpdatedAt: string | null;
};

declare global {
  var __pmAjayAdminPool: Pool | undefined;
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
    max: 3,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 30_000,
    allowExitOnIdle: true,
  });
}

function databasePool() {
  if (!globalThis.__pmAjayAdminPool) {
    globalThis.__pmAjayAdminPool = createPool();
  }
  return globalThis.__pmAjayAdminPool;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isoDate(value: Date | string | null) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function durationSeconds(startedAt: string, endedAt: string | null) {
  if (!endedAt) return null;
  return Math.max(
    0,
    Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000),
  );
}

function completionFor(beneficiary: Record<string, unknown>) {
  const fields = [
    "name",
    "district",
    "state",
    "education",
    "familyOccupation",
    "currentLivelihood",
    "skills",
    "priorTraining",
    "constraints",
    "preference",
    "language",
  ];
  const completed = fields.filter((field) => textValue(beneficiary[field])).length;
  const hasVillageOrBlock =
    Boolean(textValue(beneficiary.village)) || Boolean(textValue(beneficiary.block));
  return Math.round(((completed + Number(hasVillageOrBlock)) / 12) * 100);
}

function normalizeLanguage(language: string) {
  const aliases: Record<string, string> = {
    as: "Assamese",
    assamese: "Assamese",
    en: "English",
    english: "English",
    hi: "Hindi",
    hindi: "Hindi",
  };
  return aliases[language.toLowerCase()] || language;
}

export async function getAdminDashboardData(): Promise<DashboardData> {
  await requireAdmin();

  const pool = databasePool();
  const result = await pool.query<DatabaseSession>(`
    select
      s.id,
      s.status,
      s.language,
      s.beneficiary,
      s.started_at,
      s.ended_at,
      s.updated_at,
      p.full_name as account_name,
      coalesce(t.turn_count, 0)::int as turn_count,
      coalesce(r.recommendation_count, 0)::int as recommendation_count
    from public.counselling_sessions s
    left join public.profiles p on p.id = s.user_id
    left join (
      select session_id, count(*) as turn_count
      from public.session_turns
      group by session_id
    ) t on t.session_id = s.id
    left join (
      select session_id, count(*) as recommendation_count
      from public.session_recommendations
      group by session_id
    ) r on r.session_id = s.id
    order by s.started_at desc
  `);

  const profileResult = await pool.query<{ count: number | string }>(
    "select count(*)::int as count from public.profiles",
  );

  const sessions = result.rows.map<AdminSession>((row) => {
    const beneficiary = row.beneficiary || {};
    const startedAt = isoDate(row.started_at)!;
    const endedAt = isoDate(row.ended_at);
    const district = normalizeDistrict(textValue(beneficiary.district));
    const state = normalizeState(textValue(beneficiary.state));
    const language = normalizeLanguage(
      textValue(beneficiary.language) || textValue(row.language) || "Not captured",
    );

    return {
      id: row.id,
      name:
        textValue(beneficiary.name) ||
        textValue(row.account_name) ||
        "Unnamed beneficiary",
      status: row.status,
      language,
      district,
      state,
      startedAt,
      endedAt,
      updatedAt: isoDate(row.updated_at)!,
      durationSeconds: durationSeconds(startedAt, endedAt),
      turnCount: Number(row.turn_count),
      recommendationCount: Number(row.recommendation_count),
      profileCompletion: completionFor(beneficiary),
    };
  });

  const regionMap = new Map<string, RegionSummary>();
  const languageMap = new Map<string, number>();

  for (const session of sessions) {
    languageMap.set(session.language, (languageMap.get(session.language) || 0) + 1);

    if (!session.state && !session.district) continue;
    const key = `${session.district}|${session.state}`;
    const existing = regionMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      regionMap.set(key, {
        district: session.district,
        state: session.state,
        label:
          [session.district, session.state].filter(Boolean).join(", ") ||
          "Region not captured",
        count: 1,
      });
    }
  }

  const finishedDurations = sessions.flatMap((session) =>
    session.durationSeconds === null ? [] : [session.durationSeconds],
  );

  return {
    sessions,
    regions: [...regionMap.values()].sort((a, b) => b.count - a.count),
    languageCounts: [...languageMap.entries()]
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count),
    profileCount: Number(profileResult.rows[0]?.count || 0),
    totalSessions: sessions.length,
    completedSessions: sessions.filter((session) => session.status === "completed")
      .length,
    activeSessions: sessions.filter((session) => session.status === "active").length,
    totalTurns: sessions.reduce((sum, session) => sum + session.turnCount, 0),
    totalRecommendations: sessions.reduce(
      (sum, session) => sum + session.recommendationCount,
      0,
    ),
    identifiedLocations: sessions.filter(
      (session) => session.district || session.state,
    ).length,
    averageDurationSeconds: finishedDurations.length
      ? Math.round(
          finishedDurations.reduce((sum, seconds) => sum + seconds, 0) /
            finishedDurations.length,
        )
      : 0,
    lastUpdatedAt: sessions[0]?.updatedAt || null,
  };
}
