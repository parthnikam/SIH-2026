import { runTool } from "@/lib/catalog/search";
import { patchInterview } from "@/lib/interviews/store";
import type { Recommendation } from "@/lib/catalog/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    args?: Record<string, unknown>;
    interviewId?: string;
  };

  const name = body.name ?? "";
  const args = body.args ?? {};

  if (name === "save_profile") {
    if (!body.interviewId) {
      return Response.json({ error: "interviewId required" }, { status: 400 });
    }
    const recs = Array.isArray(args.recommendations)
      ? (args.recommendations as Recommendation[])
      : undefined;
    const saved = await patchInterview(body.interviewId, {
      profile: {
        name: args.name ? String(args.name) : undefined,
        village: args.village ? String(args.village) : undefined,
        district: args.district ? String(args.district) : undefined,
        state: args.state ? String(args.state) : undefined,
        education: args.education ? String(args.education) : undefined,
        familyOccupation: args.familyOccupation
          ? String(args.familyOccupation)
          : undefined,
        currentLivelihood: args.currentLivelihood
          ? String(args.currentLivelihood)
          : undefined,
        skills: args.skills ? String(args.skills) : undefined,
        constraints: args.constraints ? String(args.constraints) : undefined,
        preference: args.preference ? String(args.preference) : undefined,
        language: args.language ? String(args.language) : undefined,
      },
      recommendations: recs,
    });
    return Response.json({ ok: true, id: saved?.id });
  }

  return Response.json(runTool(name, args));
}
