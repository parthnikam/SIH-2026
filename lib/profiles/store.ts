import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  BeneficiaryProfile,
  ProfileCompletion,
  ProfileRequirement,
  UserProfile,
} from "@/lib/catalog/types";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import {
  getInterview,
  patchInterview,
} from "@/lib/interviews/store";

const FILE = path.join(process.cwd(), "data", "runtime-user-profiles.json");

const REQUIRED_FIELDS: Exclude<
  ProfileRequirement,
  "village" | "block"
>[] = [
  "name",
  "villageOrBlock",
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
];

let mutationQueue: Promise<void> = Promise.resolve();

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}

export function profileCompletion(
  profile: BeneficiaryProfile,
): ProfileCompletion {
  const missingFields = REQUIRED_FIELDS.filter((field) => {
    if (field === "villageOrBlock") {
      return !hasValue(profile.village) && !hasValue(profile.block);
    }
    return !hasValue(profile[field]);
  });

  return {
    complete: missingFields.length === 0,
    completionPercent: Math.round(
      ((REQUIRED_FIELDS.length - missingFields.length) /
        REQUIRED_FIELDS.length) *
        100,
    ),
    missingFields,
  };
}

function cleanPatch(patch: BeneficiaryProfile): BeneficiaryProfile {
  return Object.fromEntries(
    Object.entries(patch).flatMap(([key, value]) => {
      if (typeof value !== "string") return [];
      const cleaned = value.trim();
      return cleaned ? [[key, cleaned]] : [];
    }),
  ) as BeneficiaryProfile;
}

async function readAll(): Promise<UserProfile[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UserProfile[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeAll(rows: UserProfile[]) {
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

function newProfile(interviewId: string, initial: BeneficiaryProfile): UserProfile {
  const now = new Date().toISOString();
  const profile = cleanPatch(initial);
  return {
    schemaVersion: 1,
    id: `profile-${randomUUID()}`,
    interviewId,
    createdAt: now,
    updatedAt: now,
    profile,
    completion: profileCompletion(profile),
  };
}

function fromInterview(
  interviewId: string,
  profile: BeneficiaryProfile,
  createdAt: string,
  updatedAt: string,
): UserProfile {
  const cleaned = cleanPatch(profile);
  return {
    schemaVersion: 1,
    id: interviewId,
    interviewId,
    createdAt,
    updatedAt,
    profile: cleaned,
    completion: profileCompletion(cleaned),
  };
}

export async function ensureUserProfile(
  interviewId: string,
  initial: BeneficiaryProfile = {},
): Promise<UserProfile> {
  if (hasSupabaseEnv()) {
    const interview = await getInterview(interviewId);
    if (!interview) {
      throw new Error("Session not found.");
    }
    if (Object.keys(cleanPatch(initial)).length && !Object.keys(interview.profile).length) {
      const updated = await patchInterview(interviewId, { profile: initial });
      if (updated) {
        return fromInterview(
          interviewId,
          updated.profile,
          updated.createdAt,
          updated.updatedAt,
        );
      }
    }
    return fromInterview(
      interviewId,
      interview.profile,
      interview.createdAt,
      interview.updatedAt,
    );
  }
  return mutate(async () => {
    const rows = await readAll();
    const existing = rows.find((row) => row.interviewId === interviewId);
    if (existing) return existing;

    const row = newProfile(interviewId, initial);
    rows.unshift(row);
    await writeAll(rows);
    return row;
  });
}

export async function getUserProfile(
  interviewId: string,
): Promise<UserProfile | null> {
  if (hasSupabaseEnv()) {
    const interview = await getInterview(interviewId);
    if (!interview) return null;
    return fromInterview(
      interviewId,
      interview.profile,
      interview.createdAt,
      interview.updatedAt,
    );
  }
  const rows = await readAll();
  return rows.find((row) => row.interviewId === interviewId) ?? null;
}

export async function updateUserProfile(
  interviewId: string,
  patch: BeneficiaryProfile,
): Promise<UserProfile | null> {
  if (hasSupabaseEnv()) {
    const updated = await patchInterview(interviewId, { profile: patch });
    if (!updated) return null;
    return fromInterview(
      interviewId,
      updated.profile,
      updated.createdAt,
      updated.updatedAt,
    );
  }
  return mutate(async () => {
    const rows = await readAll();
    const index = rows.findIndex((row) => row.interviewId === interviewId);
    if (index === -1) return null;

    const current = rows[index];
    const profile = { ...current.profile, ...cleanPatch(patch) };
    const next: UserProfile = {
      ...current,
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      profile,
      completion: profileCompletion(profile),
    };
    rows[index] = next;
    await writeAll(rows);
    return next;
  });
}
