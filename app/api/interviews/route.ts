import { listInterviews, patchInterview } from "@/lib/interviews/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await listInterviews();
  return Response.json({ results: rows });
}

export async function POST(request: Request) {
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
