import { listInterviews, patchInterview } from "@/lib/interviews/store";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { getAuthUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

async function requireAuth() {
  if (!hasSupabaseEnv()) return null;
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  const rows = await listInterviews();
  return Response.json({ results: rows });
}

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const body = (await request.json()) as {
    id?: string;
    status?: "active" | "completed";
    transcript?: { role: "user" | "agent"; text: string }[];
  };
  if (!body.id) {
    return Response.json({ error: "id required" }, { status: 400 });
  }
  const saved = await patchInterview(body.id, {
    status: body.status,
    transcript: body.transcript,
  });
  if (!saved) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json(saved);
}
