import { GoogleGenAI } from "@google/genai";
import { liveConnectConfig, LIVE_MODEL } from "@/lib/live/config";
import { createInterview } from "@/lib/interviews/store";
import { ensureUserProfile } from "@/lib/profiles/store";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { getAuthUser } from "@/lib/supabase/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    if (hasSupabaseEnv()) {
      const user = await getAuthUser();
      if (!user) {
        return Response.json({ error: "Sign in required." }, { status: 401 });
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "GEMINI_API_KEY is not set on the server." },
        { status: 500 },
      );
    }

    const interview = await createInterview();
    const profile = await ensureUserProfile(interview.id, interview.profile);
    const ai = new GoogleGenAI({ apiKey });
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(
      Date.now() + 2 * 60 * 1000,
    ).toISOString();

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: liveConnectConfig(),
        },
      },
    });

    if (!token.name) {
      return Response.json({ error: "Token was not issued." }, { status: 502 });
    }

    return Response.json({
      token: token.name,
      interviewId: interview.id,
      profileId: profile.id,
      model: LIVE_MODEL,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start the call.";
    return Response.json({ error: message }, { status: 500 });
  }
}
