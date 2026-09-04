import { readFileSync } from "node:fs";
import path from "node:path";
import pathwaysJson from "@/data/pathways.json";
import centresJson from "@/data/centres.json";
import type { Centre, Course, Job, Pathway } from "./types";

type SnapshotSourceMetadata = {
  status?: unknown;
  sourceUrl?: unknown;
  rawRecordCount?: unknown;
};

type SnapshotMetadata = {
  generatedAt?: unknown;
  mode?: unknown;
  sources?: Record<string, SnapshotSourceMetadata>;
};

export type CatalogSource = {
  loadedFrom: "primary";
  isPrimarySearchFile: true;
  file: string;
  recordCount: number;
  snapshotGeneratedAt: string | null;
  refreshMode: string | null;
  upstreamStatus: string | null;
  upstreamUrl: string | null;
  upstreamRecordCount: number | null;
};

function requiredGeneratedJson(fileName: string): unknown {
  const relativePath = `data/generated/${fileName}`;

  try {
    return JSON.parse(
      readFileSync(path.join(process.cwd(), relativePath), "utf8"),
    );
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(
      `[catalog] Required generated file "${relativePath}" could not be loaded.${detail} Run "npm run data:refresh" before starting the app.`,
    );
  }
}

function requiredGeneratedArray<T>(fileName: string): T[] {
  const value = requiredGeneratedJson(fileName);
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `[catalog] Required primary search file "data/generated/${fileName}" must contain a non-empty JSON array. Run "npm run data:refresh" before starting the app.`,
    );
  }
  return value as T[];
}

function requiredSnapshotMetadata(): SnapshotMetadata {
  const value = requiredGeneratedJson("metadata.json");
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      '[catalog] Required generated file "data/generated/metadata.json" must contain a JSON object. Run "npm run data:refresh" before starting the app.',
    );
  }
  return value as SnapshotMetadata;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const snapshotMetadata = requiredSnapshotMetadata();

export const courses = requiredGeneratedArray<Course>("courses.json");
export const jobs = requiredGeneratedArray<Job>("jobs.json");
export const pathways = pathwaysJson as Pathway[];
export const centres = centresJson as Centre[];

function generatedCatalogSource(
  name: "courses" | "jobs",
  file: string,
  recordCount: number,
): CatalogSource {
  const source = snapshotMetadata.sources?.[name];
  return {
    loadedFrom: "primary",
    isPrimarySearchFile: true,
    file,
    recordCount,
    snapshotGeneratedAt: stringOrNull(snapshotMetadata.generatedAt),
    refreshMode: stringOrNull(snapshotMetadata.mode),
    upstreamStatus: stringOrNull(source?.status),
    upstreamUrl: stringOrNull(source?.sourceUrl),
    upstreamRecordCount: numberOrNull(source?.rawRecordCount),
  };
}

function staticCatalogSource(file: string, recordCount: number): CatalogSource {
  return {
    loadedFrom: "primary",
    isPrimarySearchFile: true,
    file,
    recordCount,
    snapshotGeneratedAt: null,
    refreshMode: null,
    upstreamStatus: null,
    upstreamUrl: null,
    upstreamRecordCount: null,
  };
}

export const catalogSources = {
  courses: generatedCatalogSource(
    "courses",
    "data/generated/courses.json",
    courses.length,
  ),
  jobs: generatedCatalogSource("jobs", "data/generated/jobs.json", jobs.length),
  pathways: staticCatalogSource("data/pathways.json", pathways.length),
  centres: staticCatalogSource("data/centres.json", centres.length),
} as const;
