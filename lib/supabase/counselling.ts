import type {
  BeneficiaryProfile,
  Interview,
  Recommendation,
} from "@/lib/catalog/types";
import { createClient } from "./server";

type SessionRow = {
  id: string;
  user_id: string;
  status: "active" | "completed";
  language: string | null;
  beneficiary: BeneficiaryProfile;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

type TurnRow = {
  seq: number;
  role: "user" | "agent";
  content: string;
};

type RecRow = {
  rank: number;
  kind: Recommendation["kind"];
  catalog_id: string;
  title: string;
  detail: string;
  source_url: string | null;
};

async function currentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { supabase, user: null };
  return { supabase, user: data.user };
}

async function ensureProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: NonNullable<Awaited<ReturnType<typeof currentUser>>["user"]>,
) {
  const meta = user.user_metadata ?? {};
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      full_name: (meta.full_name ?? meta.name ?? null) as string | null,
      avatar_url: (meta.avatar_url ?? meta.picture ?? null) as string | null,
    },
    { onConflict: "id" },
  );
  if (error) {
    throw new Error(
      error.message.includes("schema cache") || error.code === "PGRST205"
        ? "Supabase tables are missing. Run supabase/schema.sql in the SQL Editor."
        : error.message,
    );
  }
}

function toInterview(
  session: SessionRow,
  turns: TurnRow[] = [],
  recs: RecRow[] = [],
): Interview {
  return {
    id: session.id,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    status: session.status,
    profile: session.beneficiary ?? {},
    transcript: [...turns]
      .sort((a, b) => a.seq - b.seq)
      .map((t) => ({ role: t.role, text: t.content })),
    recommendations: [...recs]
      .sort((a, b) => a.rank - b.rank)
      .map((r) => ({
        kind: r.kind,
        id: r.catalog_id,
        title: r.title,
        detail: r.detail,
        sourceUrl: r.source_url ?? undefined,
      })),
  };
}

async function loadChildren(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
) {
  const [{ data: turns }, { data: recs }] = await Promise.all([
    supabase
      .from("session_turns")
      .select("seq, role, content")
      .eq("session_id", sessionId)
      .order("seq"),
    supabase
      .from("session_recommendations")
      .select("rank, kind, catalog_id, title, detail, source_url")
      .eq("session_id", sessionId)
      .order("rank"),
  ]);
  return {
    turns: (turns ?? []) as TurnRow[],
    recs: (recs ?? []) as RecRow[],
  };
}

export async function createInterview(): Promise<Interview> {
  const { supabase, user } = await currentUser();
  if (!user) {
    throw new Error("Sign in required.");
  }
  await ensureProfile(supabase, user);

  const { data, error } = await supabase
    .from("counselling_sessions")
    .insert({ user_id: user.id, status: "active", beneficiary: {} })
    .select("*")
    .single();

  if (error || !data) {
    const message = error?.message ?? "Could not create session.";
    throw new Error(
      message.includes("schema cache") || error?.code === "PGRST205"
        ? "Supabase tables are missing. Run supabase/schema.sql in the SQL Editor."
        : message,
    );
  }
  return toInterview(data as SessionRow);
}

export async function listInterviews(): Promise<Interview[]> {
  const { supabase, user } = await currentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("counselling_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as SessionRow[]).map((row) => toInterview(row));
}

export async function getInterview(id: string): Promise<Interview | null> {
  const { supabase, user } = await currentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("counselling_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const children = await loadChildren(supabase, id);
  return toInterview(data as SessionRow, children.turns, children.recs);
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
  const { supabase, user } = await currentUser();
  if (!user) return null;

  const { data: existing, error: existingError } = await supabase
    .from("counselling_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (existingError || !existing) return null;
  const current = existing as SessionRow;

  const nextBeneficiary = patch.profile
    ? { ...current.beneficiary, ...patch.profile }
    : current.beneficiary;

  const { data: updated, error } = await supabase
    .from("counselling_sessions")
    .update({
      status: patch.status ?? current.status,
      language: nextBeneficiary.language ?? current.language,
      beneficiary: nextBeneficiary,
      ended_at:
        patch.status === "completed"
          ? (current.ended_at ?? new Date().toISOString())
          : current.ended_at,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !updated) return null;

  if (patch.transcript) {
    await supabase.from("session_turns").delete().eq("session_id", id);
    if (patch.transcript.length) {
      const rows = patch.transcript.map((line, index) => ({
        session_id: id,
        seq: index,
        role: line.role,
        content: line.text,
      }));
      await supabase.from("session_turns").insert(rows);
    }
  }

  if (patch.recommendations) {
    await supabase.from("session_recommendations").delete().eq("session_id", id);
    if (patch.recommendations.length) {
      const rows = patch.recommendations.map((rec, index) => ({
        session_id: id,
        rank: index + 1,
        kind: rec.kind,
        catalog_id: rec.id,
        title: rec.title,
        detail: rec.detail,
        source_url: rec.sourceUrl ?? null,
      }));
      await supabase.from("session_recommendations").insert(rows);
    }
  }

  const children = await loadChildren(supabase, id);
  return toInterview(updated as SessionRow, children.turns, children.recs);
}
