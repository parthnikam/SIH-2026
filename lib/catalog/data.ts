import { readFileSync } from "node:fs";
import path from "node:path";
import seedCoursesJson from "@/data/courses.json";
import seedJobsJson from "@/data/jobs.json";
import pathwaysJson from "@/data/pathways.json";
import centresJson from "@/data/centres.json";
import type { Centre, Course, Job, Pathway } from "./types";

function generatedOrSeed<T>(fileName: string, seed: T[]): T[] {
  try {
    const filePath = path.join(process.cwd(), "data", "generated", fileName);
    const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as T[];
  } catch {
    // A clean clone has no generated snapshot until the first manual refresh.
  }
  return seed;
}

export const courses = generatedOrSeed<Course>(
  "courses.json",
  seedCoursesJson as Course[],
);
export const jobs = generatedOrSeed<Job>("jobs.json", seedJobsJson as Job[]);
export const pathways = pathwaysJson as Pathway[];
export const centres = centresJson as Centre[];
