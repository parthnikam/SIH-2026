import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Interview, BeneficiaryProfile, Recommendation } from "@/lib/catalog/types";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import * as supabaseCounselling from "@/lib/supabase/counselling";

const FILE = path.join(process.cwd(), "data", "runtime-interviews.json");
let mutationQueue: Promise<void> = Promise.resolve();

async function readAll(): Promise<Interview[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as Interview[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeAll(rows: Interview[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const temporaryFile = `${FILE}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryFile, JSON.stringify(rows, null, 2), "utf8");
    await fs.rename(temporaryFile, FILE);
  } catch (error) {
    await fs.unlink(temporaryFile).catch(() => undefined);
    throw error;
  }
}

function mutate<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function newInterviewId() {
  return `int-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createInterview(): Promise<Interview> {
  if (hasSupabaseEnv()) {
    return supabaseCounselling.createInterview();
  }
  return mutate(async () => {
    const now = new Date().toISOString();
    const row: Interview = {
      id: newInterviewId(),
      createdAt: now,
      updatedAt: now,
      status: "active",
      profile: {},
      transcript: [],
      recommendations: [],
    };
    const all = await readAll();
    all.unshift(row);
    await writeAll(all);
    return row;
  });
}

export async function listInterviews(): Promise<Interview[]> {
  if (hasSupabaseEnv()) {
    return supabaseCounselling.listInterviews();
  }
  return readAll();
}

export async function getInterview(id: string): Promise<Interview | null> {
  if (hasSupabaseEnv()) {
    return supabaseCounselling.getInterview(id);
  }
  const all = await readAll();
  return all.find((r) => r.id === id) ?? null;
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
  if (hasSupabaseEnv()) {
    return supabaseCounselling.patchInterview(id, patch);
  }
  return mutate(async () => {
    const all = await readAll();
    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const current = all[idx];
    const next: Interview = {
      ...current,
      updatedAt: new Date().toISOString(),
      status: patch.status ?? current.status,
      profile: { ...current.profile, ...patch.profile },
      transcript: patch.transcript ?? current.transcript,
      recommendations: patch.recommendations ?? current.recommendations,
    };
    all[idx] = next;
    await writeAll(all);
    return next;
  });
}
