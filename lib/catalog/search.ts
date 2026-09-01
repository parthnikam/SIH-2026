import coursesJson from "@/data/courses.json";
import jobsJson from "@/data/jobs.json";
import pathwaysJson from "@/data/pathways.json";
import centresJson from "@/data/centres.json";
import {
  EDUCATION_RANKS,
  type CatalogQuery,
  type Centre,
  type Course,
  type EducationBand,
  type EmploymentType,
  type Job,
  type Pathway,
} from "./types";

const courses = coursesJson as Course[];
const jobs = jobsJson as Job[];
const pathways = pathwaysJson as Pathway[];
const centres = centresJson as Centre[];

function tokens(value: string | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function scoreHay(hay: string, queryWords: string[]) {
  if (queryWords.length === 0) return 1;
  const h = hay.toLowerCase();
  let score = 0;
  for (const w of queryWords) {
    if (h.includes(w)) score += 3;
  }
  return score;
}

function educationOk(min: EducationBand, user?: string) {
  if (!user) return true;
  const key = user.toLowerCase() as EducationBand;
  const userRank = EDUCATION_RANKS[key];
  if (userRank === undefined) return true;
  return userRank >= EDUCATION_RANKS[min];
}

function placeBoost(
  query: CatalogQuery,
  state: string,
  district?: string,
  states?: string[],
  districts?: string[],
) {
  let boost = 0;
  const qState = query.state?.toLowerCase();
  const qDistrict = query.district?.toLowerCase();
  if (qDistrict && district?.toLowerCase() === qDistrict) boost += 8;
  if (qDistrict && districts?.some((d) => d.toLowerCase() === qDistrict))
    boost += 8;
  if (qState && state.toLowerCase() === qState) boost += 3;
  if (qState && states?.some((s) => s.toLowerCase() === qState)) boost += 3;
  if (states && states.length === 0 && !district) boost += 1;
  return boost;
}

export function searchCourses(query: CatalogQuery): Course[] {
  const words = tokens(query.query);
  const limit = query.limit ?? 5;
  const emp = query.employmentType as EmploymentType | undefined;
  return courses
    .map((c) => {
      if (!educationOk(c.minEducation, query.education)) return null;
      if (query.sector && !c.sector.toLowerCase().includes(query.sector.toLowerCase()) && !c.giaDomain.toLowerCase().includes(query.sector.toLowerCase()))
        return null;
      if (emp && emp !== "either" && c.employmentType !== "either" && c.employmentType !== emp)
        return null;
      const hay = `${c.title} ${c.qpCode} ${c.sector} ${c.giaDomain} ${c.summary} ${c.scheme}`;
      const s = scoreHay(hay, words) + placeBoost(query, query.state ?? "", undefined, c.states, c.districts);
      if (words.length && s < 3) return null;
      return { item: c, s };
    })
    .filter((x): x is { item: Course; s: number } => x !== null)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.item);
}

export function searchJobs(query: CatalogQuery): Job[] {
  const words = tokens(query.query);
  const limit = query.limit ?? 5;
  return jobs
    .map((j) => {
      if (!educationOk(j.minEducation, query.education)) return null;
      if (query.sector && !j.sector.toLowerCase().includes(query.sector.toLowerCase()) && !j.title.toLowerCase().includes(query.sector.toLowerCase()))
        return null;
      const hay = `${j.title} ${j.employer} ${j.sector} ${j.district} ${j.state} ${j.summary}`;
      const keyword = scoreHay(hay, words);
      if (words.length && keyword < 3) return null;
      if (query.district && j.district.toLowerCase() !== query.district.toLowerCase())
        return null;
      const s = keyword + placeBoost(query, j.state, j.district);
      return { item: j, s };
    })
    .filter((x): x is { item: Job; s: number } => x !== null)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.item);
}

export function searchPathways(query: CatalogQuery): Pathway[] {
  const words = tokens(query.query);
  const limit = query.limit ?? 4;
  const emp = query.employmentType as EmploymentType | undefined;
  return pathways
    .map((p) => {
      if (emp && emp !== "either" && p.employmentType !== "either" && p.employmentType !== emp)
        return null;
      const hay = `${p.title} ${p.giaDomain} ${p.summary} ${p.kind}`;
      const s = scoreHay(hay, words) + (emp === "self" && p.kind === "nsfdc" ? 4 : 0);
      if (words.length && s < 3) return null;
      return { item: p, s };
    })
    .filter((x): x is { item: Pathway; s: number } => x !== null)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.item);
}

export function searchCentres(query: CatalogQuery): Centre[] {
  const words = tokens(query.query);
  const limit = query.limit ?? 4;
  return centres
    .map((c) => {
      const hay = `${c.name} ${c.district} ${c.state} ${c.sectors.join(" ")}`;
      const s = scoreHay(hay, words) + placeBoost(query, c.state, c.district);
      if (query.district && c.district.toLowerCase() !== query.district.toLowerCase())
        return null;
      return { item: c, s };
    })
    .filter((x): x is { item: Centre; s: number } => x !== null)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.item);
}

export function parseQuery(url: URL): CatalogQuery {
  const education = url.searchParams.get("education") ?? undefined;
  const employmentType = url.searchParams.get("employmentType") ?? undefined;
  return {
    query: url.searchParams.get("query") ?? url.searchParams.get("q") ?? undefined,
    state: url.searchParams.get("state") ?? undefined,
    district: url.searchParams.get("district") ?? undefined,
    education,
    sector: url.searchParams.get("sector") ?? undefined,
    employmentType,
    limit: url.searchParams.get("limit")
      ? Number(url.searchParams.get("limit"))
      : undefined,
  };
}

function compactCourse(c: Course) {
  return {
    id: c.id,
    title: c.title,
    qpCode: c.qpCode,
    nsqfLevel: c.nsqfLevel,
    hours: c.hours,
    sector: c.sector,
    scheme: c.scheme,
    employmentType: c.employmentType,
    sourceUrl: c.sourceUrl,
    summary: c.summary,
  };
}

function compactJob(j: Job) {
  return {
    id: j.id,
    title: j.title,
    employer: j.employer,
    district: j.district,
    state: j.state,
    wage: j.wage,
    type: j.type,
    sourceUrl: j.sourceUrl,
    summary: j.summary,
  };
}

function compactPathway(p: Pathway) {
  return {
    id: p.id,
    title: p.title,
    kind: p.kind,
    nextStep: p.nextStep,
    sourceUrl: p.sourceUrl,
    summary: p.summary,
  };
}

function compactCentre(c: Centre) {
  return {
    id: c.id,
    name: c.name,
    district: c.district,
    state: c.state,
    sectors: c.sectors,
    address: c.address,
    sourceUrl: c.sourceUrl,
  };
}

export function runTool(
  name: string,
  args: Record<string, unknown>,
) {
  const query: CatalogQuery = {
    query: String(args.query ?? args.q ?? ""),
    state: args.state ? String(args.state) : undefined,
    district: args.district ? String(args.district) : undefined,
    education: args.education ? String(args.education) : undefined,
    sector: args.sector ? String(args.sector) : undefined,
    employmentType: args.employmentType
      ? String(args.employmentType)
      : undefined,
    limit: args.limit ? Number(args.limit) : undefined,
  };

  switch (name) {
    case "search_courses":
      return { courses: searchCourses(query).map(compactCourse) };
    case "search_jobs":
      return { jobs: searchJobs(query).map(compactJob) };
    case "search_pathways":
      return { pathways: searchPathways(query).map(compactPathway) };
    case "search_centres":
      return { centres: searchCentres(query).map(compactCentre) };
    default:
      return { error: `Unknown tool ${name}` };
  }
}
