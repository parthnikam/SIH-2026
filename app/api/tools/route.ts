import { runTool } from "@/lib/catalog/search";
import type {
  BeneficiaryProfile,
  Recommendation,
} from "@/lib/catalog/types";
import { getInterview, patchInterview } from "@/lib/interviews/store";
import {
  ensureUserProfile,
  updateUserProfile,
} from "@/lib/profiles/store";

const PROFILE_FIELDS = [
  "name",
  "village",
  "block",
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
] as const satisfies readonly (keyof BeneficiaryProfile)[];

const CATALOG_TOOLS = new Set([
  "search_courses",
  "search_jobs",
  "search_pathways",
  "search_centres",
]);

const RECOMMENDATION_KINDS = new Set<Recommendation["kind"]>([
  "course",
  "job",
  "pathway",
  "centre",
]);

function profilePatch(args: Record<string, unknown>): BeneficiaryProfile {
  const patch: BeneficiaryProfile = {};
  for (const field of PROFILE_FIELDS) {
    const value = args[field];
    if (typeof value === "string" && value.trim()) {
      patch[field] = value.trim();
    }
  }
  return patch;
}

function recommendationsFrom(value: unknown): Recommendation[] | null {
  if (!Array.isArray(value)) return null;

  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const row = candidate as Record<string, unknown>;
    if (
      typeof row.kind !== "string" ||
      !RECOMMENDATION_KINDS.has(row.kind as Recommendation["kind"]) ||
      typeof row.id !== "string" ||
      typeof row.title !== "string" ||
      typeof row.detail !== "string" ||
      !row.id.trim() ||
      !row.title.trim() ||
      !row.detail.trim()
    ) {
      return [];
    }

    return [
      {
        kind: row.kind as Recommendation["kind"],
        id: row.id.trim(),
        title: row.title.trim(),
        detail: row.detail.trim(),
        sourceUrl:
          typeof row.sourceUrl === "string" && row.sourceUrl.trim()
            ? row.sourceUrl.trim()
            : undefined,
      },
    ];
  });
}

async function profileForInterview(interviewId: string) {
  const interview = await getInterview(interviewId);
  if (!interview) return null;
  return ensureUserProfile(interviewId, interview.profile);
}

function profileResponse(profile: Awaited<ReturnType<typeof ensureUserProfile>>) {
  return {
    ok: true,
    profileId: profile.id,
    profile: profile.profile,
    complete: profile.completion.complete,
    completionPercent: profile.completion.completionPercent,
    missingFields: profile.completion.missingFields,
  };
}

export async function POST(request: Request) {
  try {
  const body = (await request.json()) as {
    name?: string;
    args?: Record<string, unknown>;
    interviewId?: string;
  };

  const name = body.name ?? "";
  const args = body.args ?? {};

  if (!body.interviewId) {
    return Response.json({ error: "interviewId required" }, { status: 400 });
  }

  const currentProfile = await profileForInterview(body.interviewId);
  if (!currentProfile) {
    return Response.json({ error: "interview not found" }, { status: 404 });
  }

  if (name === "update_profile" || name === "save_profile") {
    const updated = await updateUserProfile(
      body.interviewId,
      profilePatch(args),
    );
    if (!updated) {
      return Response.json({ error: "profile not found" }, { status: 404 });
    }

    await patchInterview(body.interviewId, { profile: updated.profile });

    // Accept the old combined tool shape for calls that were already live during
    // a deployment. New sessions use save_recommendations separately.
    if (name === "save_profile") {
      const recommendations = recommendationsFrom(args.recommendations);
      if (updated.completion.complete && recommendations) {
        await patchInterview(body.interviewId, { recommendations });
      }
    }

    return Response.json(profileResponse(updated));
  }

  if (name === "save_recommendations") {
    if (!currentProfile.completion.complete) {
      return Response.json(
        {
          error: "PROFILE_INCOMPLETE",
          message: "Complete the profile before saving recommendations.",
          missingFields: currentProfile.completion.missingFields,
        },
        { status: 409 },
      );
    }

    const recommendations = recommendationsFrom(args.recommendations);
    if (
      !recommendations ||
      recommendations.length < 2 ||
      recommendations.length > 3
    ) {
      return Response.json(
        { error: "Exactly two or three valid recommendations are required." },
        { status: 400 },
      );
    }
    const interview = await patchInterview(body.interviewId, { recommendations });
    return Response.json({
      ok: true,
      id: interview?.id,
      saved: recommendations.length,
    });
  }

  if (CATALOG_TOOLS.has(name)) {
    if (!currentProfile.completion.complete) {
      return Response.json(
        {
          error: "PROFILE_INCOMPLETE",
          message:
            "Ask for the missing details and call update_profile before searching.",
          completionPercent: currentProfile.completion.completionPercent,
          missingFields: currentProfile.completion.missingFields,
        },
        { status: 409 },
      );
    }

    const saved = currentProfile.profile;
    return Response.json(
      runTool(name, {
        ...args,
        query: args.query || saved.skills,
        state: saved.state,
        district: saved.district,
        education: saved.education,
        employmentType: saved.preference,
      }),
    );
  }

  return Response.json({ error: `Unknown tool ${name}` }, { status: 400 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Tool request failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
