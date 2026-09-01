import { promises as fs } from "fs";
import path from "path";
import type { Interview, BeneficiaryProfile, Recommendation } from "@/lib/catalog/types";

const FILE = path.join(process.cwd(), "data", "runtime-interviews.json");

async function readAll(): Promise<Interview[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as Interview[];
  } catch {
    return [];
  }
}

async function writeAll(rows: Interview[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2), "utf8");
}

export function newInterviewId() {
  return `int-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createInterview(): Promise<Interview> {
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
}

export async function listInterviews(): Promise<Interview[]> {
  return readAll();
}

export async function getInterview(id: string): Promise<Interview | null> {
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
}
