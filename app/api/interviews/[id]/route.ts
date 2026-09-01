import { getInterview } from "@/lib/interviews/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const row = await getInterview(id);
  if (!row) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json(row);
}
