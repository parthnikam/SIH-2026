import "server-only";

import type { Pool, PoolClient, QueryResultRow } from "pg";
import type {
  BeneficiaryProfile,
  Interview,
  Recommendation,
} from "@/lib/catalog/types";
import { getSupabasePool } from "./database";
import { getOrCreateVisitorId, getVisitorId } from "./visitor";

interface SessionRow extends QueryResultRow {
  id: string;
  user_id: string | null;
  visitor_id: string;
  status: "active" | "completed";
  language: string | null;
  beneficiary: BeneficiaryProfile | null;
  started_at: Date | string;
  ended_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface TurnRow extends QueryResultRow {
  seq: number;
  role: "user" | "agent";
  content: string;
}

interface RecRow extends QueryResultRow {
  rank: number;
  kind: Recommendation["kind"];
  catalog_id: string;
  title: string;
  detail: string;
  source_url: string | null;
}

type Queryable = Pool | PoolClient;

function isoDate(value: Date | string) {
  return new Date(value).toISOString();
}

function databaseError(error: unknown): Error {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "42703"
  ) {
    return new Error(
      "Supabase visitor storage is not installed. Run supabase/migrations/20260905_remove_google_auth.sql.",
    );
  }
  return error instanceof Error ? error : new Error("Supabase query failed.");
}

function toInterview(
  session: SessionRow,
  turns: TurnRow[] = [],
  recommendations: RecRow[] = [],
): Interview {
  return {
    id: session.id,
    createdAt: isoDate(session.created_at),
    updatedAt: isoDate(session.updated_at),
    status: session.status,
    profile: session.beneficiary ?? {},
    transcript: [...turns]
      .sort((a, b) => a.seq - b.seq)
      .map((turn) => ({ role: turn.role, text: turn.content })),
    recommendations: [...recommendations]
      .sort((a, b) => a.rank - b.rank)
      .map((recommendation) => ({
        kind: recommendation.kind,
        id: recommendation.catalog_id,
        title: recommendation.title,
        detail: recommendation.detail,
        sourceUrl: recommendation.source_url ?? undefined,
      })),
  };
}

async function loadChildren(database: Queryable, sessionId: string) {
  const [turns, recommendations] = await Promise.all([
    database.query<TurnRow>(
      `select seq, role, content
       from public.session_turns
       where session_id = $1
       order by seq`,
      [sessionId],
    ),
    database.query<RecRow>(
      `select rank, kind, catalog_id, title, detail, source_url
       from public.session_recommendations
       where session_id = $1
       order by rank`,
      [sessionId],
    ),
  ]);

  return { turns: turns.rows, recommendations: recommendations.rows };
}

export async function createInterview(): Promise<Interview> {
  const visitorId = await getOrCreateVisitorId();

  try {
    const result = await getSupabasePool().query<SessionRow>(
      `insert into public.counselling_sessions
        (user_id, visitor_id, status, beneficiary)
       values (null, $1, 'active', '{}'::jsonb)
       returning *`,
      [visitorId],
    );
    return toInterview(result.rows[0]);
  } catch (error) {
    throw databaseError(error);
  }
}

export async function listInterviews(): Promise<Interview[]> {
  const visitorId = await getVisitorId();
  if (!visitorId) return [];

  try {
    const result = await getSupabasePool().query<SessionRow>(
      `select *
       from public.counselling_sessions
       where visitor_id = $1
       order by created_at desc`,
      [visitorId],
    );
    return result.rows.map((row) => toInterview(row));
  } catch (error) {
    throw databaseError(error);
  }
}

export async function getInterview(id: string): Promise<Interview | null> {
  const visitorId = await getVisitorId();
  if (!visitorId) return null;

  try {
    const pool = getSupabasePool();
    const result = await pool.query<SessionRow>(
      `select *
       from public.counselling_sessions
       where id = $1 and visitor_id = $2`,
      [id, visitorId],
    );
    const session = result.rows[0];
    if (!session) return null;

    const children = await loadChildren(pool, id);
    return toInterview(session, children.turns, children.recommendations);
  } catch (error) {
    throw databaseError(error);
  }
}

export async function patchInterview(
  id: string,
  patch: {
    status?: Interview["status"];
    profile?: BeneficiaryProfile;
    transcript?: Interview["transcript"];
    recommendations?: Recommendation[];
  },
): Promise<Interview | null> {
  const visitorId = await getVisitorId();
  if (!visitorId) return null;

  const client = await getSupabasePool().connect();
  try {
    await client.query("begin");
    const existingResult = await client.query<SessionRow>(
      `select *
       from public.counselling_sessions
       where id = $1 and visitor_id = $2
       for update`,
      [id, visitorId],
    );
    const current = existingResult.rows[0];
    if (!current) {
      await client.query("rollback");
      return null;
    }

    const nextBeneficiary = patch.profile
      ? { ...(current.beneficiary ?? {}), ...patch.profile }
      : (current.beneficiary ?? {});
    const completedAt =
      patch.status === "completed"
        ? (current.ended_at ?? new Date())
        : current.ended_at;

    const updatedResult = await client.query<SessionRow>(
      `update public.counselling_sessions
       set status = $3,
           language = $4,
           beneficiary = $5,
           ended_at = $6
       where id = $1 and visitor_id = $2
       returning *`,
      [
        id,
        visitorId,
        patch.status ?? current.status,
        nextBeneficiary.language ?? current.language,
        nextBeneficiary,
        completedAt,
      ],
    );

    if (patch.transcript) {
      await client.query(
        "delete from public.session_turns where session_id = $1",
        [id],
      );
      for (const [sequence, line] of patch.transcript.entries()) {
        await client.query(
          `insert into public.session_turns (session_id, seq, role, content)
           values ($1, $2, $3, $4)`,
          [id, sequence, line.role, line.text],
        );
      }
    }

    if (patch.recommendations) {
      await client.query(
        "delete from public.session_recommendations where session_id = $1",
        [id],
      );
      for (const [index, recommendation] of patch.recommendations.entries()) {
        await client.query(
          `insert into public.session_recommendations
            (session_id, rank, kind, catalog_id, title, detail, source_url)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id,
            index + 1,
            recommendation.kind,
            recommendation.id,
            recommendation.title,
            recommendation.detail,
            recommendation.sourceUrl ?? null,
          ],
        );
      }
    }

    const children = await loadChildren(client, id);
    await client.query("commit");
    return toInterview(
      updatedResult.rows[0],
      children.turns,
      children.recommendations,
    );
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw databaseError(error);
  } finally {
    client.release();
  }
}
