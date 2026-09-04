import { getInterview } from "@/lib/interviews/store";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { getAuthUser } from "@/lib/supabase/auth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (hasSupabaseEnv()) {
    const user = await getAuthUser();
    if (!user) {
      return Response.json({ error: "Sign in required." }, { status: 401 });
    }
  }
  const { id } = await context.params;
  const row = await getInterview(id);
  if (!row) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json(row);
}
