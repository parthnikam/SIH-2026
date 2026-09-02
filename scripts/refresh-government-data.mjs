import { createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import { rootCertificates } from "node:tls";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const GENERATED_DIR = path.join(DATA_DIR, "generated");

const PM_AJAY_URL = "https://pmajay.dosje.gov.in/CourseList";
const NCS_SEARCH_URL = "https://api.ncs.gov.in/api/v1/job-posts/search";
const NCS_JOB_URL = "https://www.ncs.gov.in/job-listing/applying";

// NCS uses these values in its public web client to wrap API payloads. They are
// transport obfuscation, not application credentials, and may change upstream.
const NCS_CRYPTO_KEY =
  process.env.GOV_DATA_NCS_CRYPTO_KEY ?? "NcsSecureKey2024NcsSecureKey2024";
const NCS_CRYPTO_IV =
  process.env.GOV_DATA_NCS_CRYPTO_IV ?? "NcsInitVector123";

const OFFLINE =
  process.argv.includes("--offline") || process.env.GOV_DATA_OFFLINE === "1";
const STRICT =
  process.argv.includes("--strict") || process.env.GOV_DATA_STRICT === "1";
const REQUEST_TIMEOUT_MS = boundedInteger(
  process.env.GOV_DATA_TIMEOUT_MS,
  15_000,
  2_000,
  60_000,
);
const NCS_PAGE_SIZE = boundedInteger(
  process.env.GOV_DATA_NCS_PAGE_SIZE,
  100,
  20,
  100,
);
const NCS_CONCURRENCY = boundedInteger(
  process.env.GOV_DATA_NCS_CONCURRENCY,
  4,
  1,
  8,
);
const NCS_RETRIES = boundedInteger(
  process.env.GOV_DATA_NCS_RETRIES,
  3,
  1,
  5,
);

function boundedInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function cleanWhitespace(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code) => {
    if (code[0] === "#") {
      const isHex = code[1]?.toLowerCase() === "x";
      const number = Number.parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
    }
    return named[code.toLowerCase()] ?? entity;
  });
}

function stripHtml(value) {
  return cleanWhitespace(
    decodeHtmlEntities(
      String(value ?? "")
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

function slug(value) {
  return cleanWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "record";
}

function shortHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function atomicWriteJson(fileName, value) {
  await mkdir(GENERATED_DIR, { recursive: true });
  const destination = path.join(GENERATED_DIR, fileName);
  const temporary = path.join(
    GENERATED_DIR,
    `.${fileName}.${process.pid}.${Date.now()}.tmp`,
  );
  const indentation = fileName === "metadata.json" ? 2 : 0;
  await writeFile(
    temporary,
    `${JSON.stringify(value, null, indentation)}\n`,
    "utf8",
  );
  await rename(temporary, destination);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function withRetries(operation, label) {
  let lastError;
  for (let attempt = 1; attempt <= NCS_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === NCS_RETRIES) break;
      const backoff = 500 * 2 ** (attempt - 1);
      console.warn(
        `[government-data] ${label} failed (attempt ${attempt}/${NCS_RETRIES}); ` +
          `retrying in ${backoff}ms: ${messageOf(error)}`,
      );
      await delay(backoff);
    }
  }
  throw lastError;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await mapper(items[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "*/*",
        "User-Agent": "SIH-2026-government-data-poc/0.1",
        ...options.headers,
      },
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} from ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPmAjayText() {
  try {
    return await fetchText(PM_AJAY_URL, { headers: { Accept: "text/html" } });
  } catch (error) {
    const errorCode = error?.cause?.code;
    if (errorCode !== "UNABLE_TO_GET_ISSUER_CERT_LOCALLY") throw error;

    // PM-AJAY currently serves Let’s Encrypt's new YR hierarchy. Node's bundled
    // roots do not trust it yet, so add the official YR-by-X1 cross-certificate
    // only for this host. Normal certificate and hostname checks remain active.
    const compatibilityCa = await readFile(
      path.join(PROJECT_ROOT, "scripts", "certs", "isrg-root-yr-by-x1.pem"),
      "utf8",
    );
    return httpsGetText(PM_AJAY_URL, compatibilityCa);
  }
}

function httpsGetText(url, additionalCa, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        ca: [...rootCertificates, additionalCa],
        headers: {
          Accept: "text/html",
          "User-Agent": "SIH-2026-government-data-poc/0.1",
        },
      },
      (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          if (redirectsLeft <= 0) {
            reject(new Error(`Too many redirects from ${url}`));
            return;
          }
          resolve(
            httpsGetText(
              new URL(response.headers.location, url),
              additionalCa,
              redirectsLeft - 1,
            ),
          );
          return;
        }

        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          response.resume();
          reject(new Error(`${response.statusCode ?? "Unknown status"} from ${url}`));
          return;
        }

        response.setEncoding("utf8");
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => resolve(body));
      },
    );
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
    request.on("error", reject);
  });
}

function findTable(html, id) {
  const idPattern = new RegExp(`\\bid=["']${id}["']`, "i");
  const match = idPattern.exec(html);
  if (!match) throw new Error(`Could not find table #${id}`);

  const start = html.lastIndexOf("<table", match.index);
  const end = html.indexOf("</table>", match.index);
  if (start < 0 || end < 0) throw new Error(`Table #${id} is incomplete`);
  return html.slice(start, end + "</table>".length);
}

function normalizeQpCode(value) {
  return cleanWhitespace(value).replace(/\s+/g, "").toUpperCase();
}

function parsePmAjayCourses(html, seedCourses) {
  const table = findTable(html, "table4");
  const seedByCode = new Map();
  for (const course of seedCourses) {
    const code = normalizeQpCode(course.qpCode);
    if (code && !seedByCode.has(code)) seedByCode.set(code, course);
  }

  const records = [];
  const rawRecords = [];
  const seen = new Set();
  let upstreamRows = 0;
  for (const rowMatch of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (match) => stripHtml(match[1]),
    );
    if (cells.length < 7 || !/^\d+$/.test(cells[0])) continue;
    upstreamRows += 1;

    const [serial, courseLevel, sector, subSector, courseName, rawCode, subCourseName] = cells;
    const qpCode = normalizeQpCode(rawCode);
    rawRecords.push({
      serial: Number(serial),
      courseLevel,
      sector,
      subSector,
      courseName,
      subCourseCode: rawCode,
      normalizedQpCode: qpCode,
      subCourseName,
      sourceUrl: PM_AJAY_URL,
    });
    const title = cleanWhitespace(subCourseName || courseName);
    if (!title || !qpCode) continue;

    const dedupeKey = `${qpCode}|${title.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const enrichment = seedByCode.get(qpCode);
    records.push({
      id: `pmajay-${slug(qpCode)}-${shortHash(dedupeKey)}`,
      title,
      qpCode,
      nsqfLevel: enrichment?.nsqfLevel ?? null,
      hours: enrichment?.hours ?? null,
      sector: sector || enrichment?.sector || "Skill Development",
      giaDomain: enrichment?.giaDomain ?? sector ?? "Skill Development",
      minEducation: enrichment?.minEducation ?? null,
      states: enrichment?.states ?? [],
      districts: enrichment?.districts ?? [],
      scheme: "PM-AJAY",
      employmentType: enrichment?.employmentType ?? "either",
      source: "PM-AJAY, Ministry of Social Justice and Empowerment",
      sourceUrl: PM_AJAY_URL,
      summary:
        enrichment?.summary ??
        cleanWhitespace(
          `${courseName || title}${subSector ? `; ${subSector}` : ""}. ` +
            `Listed at the ${courseLevel || "national"} course level.`,
        ),
      courseLevel: courseLevel || null,
      courseName: courseName || null,
      subSector: subSector || null,
      upstreamSerial: Number(serial),
    });
  }

  if (records.length < 100) {
    throw new Error(`PM-AJAY parser produced only ${records.length} courses`);
  }

  const asOf = html.match(
    /Course-List\s+as\s+on\s+(\d{1,2}[-/]\d{1,2}[-/]\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/i,
  )?.[1];
  return {
    records,
    rawRecords,
    details: {
      upstreamRows,
      rawRecordCount: rawRecords.length,
      sourceDataAsOf: asOf ? cleanWhitespace(asOf) : null,
    },
  };
}

function encryptNcsPayload(payload) {
  const key = Buffer.from(NCS_CRYPTO_KEY, "utf8");
  const iv = Buffer.from(NCS_CRYPTO_IV, "utf8");
  if (key.length !== 32 || iv.length !== 16) {
    throw new Error("NCS crypto key must be 32 bytes and IV must be 16 bytes");
  }
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  return cipher.update(JSON.stringify(payload), "utf8", "base64") + cipher.final("base64");
}

function decryptNcsText(value) {
  const decipher = createDecipheriv(
    "aes-256-cbc",
    Buffer.from(NCS_CRYPTO_KEY, "utf8"),
    Buffer.from(NCS_CRYPTO_IV, "utf8"),
  );
  return decipher.update(value.trim(), "base64", "utf8") + decipher.final("utf8");
}

function parseNcsResponse(rawText) {
  const trimmed = rawText.trim();
  if (!trimmed) throw new Error("NCS returned an empty response");

  let payload;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    payload = JSON.parse(trimmed);
    if (typeof payload?.data === "string") {
      payload = { ...payload, data: JSON.parse(decryptNcsText(payload.data)) };
    }
  } else {
    payload = JSON.parse(decryptNcsText(trimmed));
  }

  if (payload?.status === false) {
    throw new Error(payload.message || "NCS rejected the request");
  }
  if (!Array.isArray(payload?.data?.content)) {
    throw new Error("NCS response does not contain a job list");
  }
  return payload;
}

async function fetchNcsPage(page) {
  const fixture = process.env.GOV_DATA_NCS_RESPONSE_FILE;
  if (fixture) {
    if (page > 0) return null;
    return parseNcsResponse(await readFile(path.resolve(PROJECT_ROOT, fixture), "utf8"));
  }

  return withRetries(async () => {
    const body = encryptNcsPayload({ sortBy: "NEWEST" });
    const url = new URL(NCS_SEARCH_URL);
    url.searchParams.set("page", String(page));
    url.searchParams.set("size", String(NCS_PAGE_SIZE));
    const response = await fetchText(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body,
    });
    return parseNcsResponse(response);
  }, `NCS page ${page + 1}`);
}

function educationBand(job) {
  if (job.anyEducationPreference === true) return "none";
  const preferences = Array.isArray(job.educationPreferences)
    ? job.educationPreferences
    : [];
  const ranks = { none: 0, "5th": 1, "8th": 2, "10th": 3, "12th": 4, iti: 4, graduate: 5 };
  const bands = preferences
    .map((preference) =>
      cleanWhitespace(
        `${preference?.educationType ?? ""} ${preference?.degree ?? ""}`,
      ).toLowerCase(),
    )
    .map((value) => {
      if (/no formal|not required|illiterate/.test(value)) return "none";
      if (/\b5(?:th)?\b|primary/.test(value)) return "5th";
      if (/\b8(?:th)?\b|middle/.test(value)) return "8th";
      if (/\b12(?:th)?\b|higher secondary|senior secondary|hsc|diploma/.test(value)) return "12th";
      if (/\b10(?:th)?\b|secondary|ssc/.test(value)) return "10th";
      if (/\biti\b|industrial training institute/.test(value)) return "iti";
      if (/graduate|bachelor|postgraduate|master|doctorate/.test(value)) return "graduate";
      return null;
    })
    .filter(Boolean);

  return bands.sort((a, b) => ranks[a] - ranks[b])[0] ?? null;
}

function jobType(value) {
  const normalized = cleanWhitespace(value).toLowerCase();
  if (normalized.includes("apprent")) return "apprentice";
  if (normalized.includes("gig") || normalized.includes("freelance")) return "gig";
  return "wage";
}

function formatRupees(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function wageLabel(job) {
  if (job.hideSalaryRange) return "Not disclosed";
  const min = Number(job.minSalary);
  const max = Number(job.maxSalary);
  const hasMin = Number.isFinite(min) && min > 0;
  const hasMax = Number.isFinite(max) && max > 0;
  if (hasMin && hasMax) return `${formatRupees(min)}–${formatRupees(max)}/year`;
  if (hasMin) return `From ${formatRupees(min)}/year`;
  if (hasMax) return `Up to ${formatRupees(max)}/year`;
  return "Not disclosed";
}

function redactContactDetails(value) {
  return stripHtml(value)
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, " ")
    .replace(/(?:\+?91[\s.-]?)?[6-9](?:[\s.-]?\d){9}\b/g, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeDescription(value) {
  const cleaned = redactContactDetails(value)
    .replace(/\b(?:call|contact|whats?app)\b[^.]{0,100}\.?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= 360) return cleaned;
  const shortened = cleaned.slice(0, 360);
  const wordBoundary = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, wordBoundary > 280 ? wordBoundary : 360).trim()}.`;
}

function cleanNcsJobs(postings) {
  const records = [];
  const seen = new Set();
  const now = Date.now();

  for (const job of postings) {
    const upstreamId = Number(job?.id);
    const title = redactContactDetails(job?.jobTitle);
    if (!Number.isFinite(upstreamId) || !title) continue;
    if (job.status && job.status !== "PUBLISHED") continue;

    const expiry = job.expiredAt ? Date.parse(job.expiredAt) : Number.NaN;
    if (Number.isFinite(expiry) && expiry < now) continue;

    const rawLocations = Array.isArray(job.jobLocations) ? job.jobLocations : [];
    const locations = rawLocations
      .map((location) => ({
        district: cleanWhitespace(location?.city),
        state: cleanWhitespace(location?.state),
      }))
      .filter((location) => location.district || location.state);

    if (job.isJobAllIndiaOrRemote || locations.length === 0) {
      locations.push({ district: "Remote / All India", state: "All India" });
    }

    const uniqueLocations = new Map(
      locations.map((location) => [
        `${location.district.toLowerCase()}|${location.state.toLowerCase()}`,
        location,
      ]),
    );
    const skills = [
      ...(Array.isArray(job.requiredSkills) ? job.requiredSkills : []),
      ...(Array.isArray(job.keySkills) ? job.keySkills : []),
    ]
      .map(cleanWhitespace)
      .filter(Boolean)
      .filter((value, index, all) => all.indexOf(value) === index)
      .slice(0, 12);
    const description = safeDescription(job.jobDescription);
    const functionalRole = cleanWhitespace(job.functionalState);
    const summary =
      description ||
      cleanWhitespace(
        `${functionalRole || title}.${skills.length ? ` Skills: ${skills.join(", ")}.` : ""}`,
      );

    for (const location of uniqueLocations.values()) {
      const locationKey = `${upstreamId}|${location.district}|${location.state}`;
      if (seen.has(locationKey)) continue;
      seen.add(locationKey);
      records.push({
        id: `ncs-${upstreamId}-${shortHash(locationKey)}`,
        upstreamId,
        title,
        employer:
          redactContactDetails(job.organizationName || job.organization) ||
          "Employer on NCS",
        sector:
          cleanWhitespace(job.functionalArea || job.industry || functionalRole) ||
          "Other",
        district: location.district || "Location not specified",
        state: location.state || "State not specified",
        wage: wageLabel(job),
        type: jobType(job.jobType || job.jobNatures),
        minEducation: educationBand(job),
        source: "National Career Service, Ministry of Labour and Employment",
        sourceUrl: `${NCS_JOB_URL}/${upstreamId}`,
        summary,
        skills,
        vacancies: Number.isFinite(Number(job.noOfVacancies))
          ? Number(job.noOfVacancies)
          : null,
        postedAt: job.publishedAt || job.createdAt || null,
        expiresAt: job.expiredAt || null,
        remote: Boolean(job.isJobAllIndiaOrRemote),
      });
    }
  }

  if (records.length < 10) {
    throw new Error(`NCS cleaner produced only ${records.length} location records`);
  }
  return records;
}

async function loadPmAjay(seedCourses) {
  const fixture = process.env.GOV_DATA_PMAJAY_HTML_FILE;
  const html = fixture
    ? await readFile(path.resolve(PROJECT_ROOT, fixture), "utf8")
    : await fetchPmAjayText();
  return parsePmAjayCourses(html, seedCourses);
}

async function loadNcs() {
  const first = await fetchNcsPage(0);
  const availablePages = Number(first.data.totalPages) || 1;
  const pageCount = process.env.GOV_DATA_NCS_RESPONSE_FILE ? 1 : availablePages;
  let completedPages = 1;
  console.log(
    `[government-data] NCS reports ${Number(first.data.totalElements) || 0} ` +
      `postings across ${pageCount} pages; downloading all pages...`,
  );
  const pageNumbers = Array.from(
    { length: Math.max(0, pageCount - 1) },
    (_, index) => index + 1,
  );
  const remaining = await mapWithConcurrency(
    pageNumbers,
    NCS_CONCURRENCY,
    async (page) => {
      const response = await fetchNcsPage(page);
      completedPages += 1;
      if (completedPages % 10 === 0 || completedPages === pageCount) {
        console.log(
          `[government-data] NCS pages: ${completedPages}/${pageCount}`,
        );
      }
      return response;
    },
  );
  const responses = [first, ...remaining].filter(Boolean);
  const fetchedPostings = responses.flatMap((response) => response.data.content);
  const uniquePostings = new Map();
  for (const posting of fetchedPostings) {
    const key = posting?.id == null
      ? `record-${shortHash(JSON.stringify(posting))}`
      : String(posting.id);
    uniquePostings.set(key, posting);
  }
  const postings = [...uniquePostings.values()];
  return {
    records: cleanNcsJobs(postings),
    rawRecords: postings,
    details: {
      fetchedPages: responses.length,
      upstreamPostings: postings.length,
      duplicatePostingsRemoved: fetchedPostings.length - postings.length,
      rawRecordCount: postings.length,
      totalAvailable: Number(first.data.totalElements) || null,
    },
  };
}

function usableRecords(value) {
  return Array.isArray(value) && value.length > 0;
}

async function refreshSource({
  name,
  liveLoader,
  previous,
  previousDetails,
  previousRaw,
  seed,
  sourceUrl,
}) {
  if (OFFLINE) {
    const cached = usableRecords(previous) ? previous : seed;
    const cachedRaw = Array.isArray(previousRaw) ? previousRaw : [];
    return {
      ...previousDetails,
      records: cached,
      rawRecords: cachedRaw,
      status: usableRecords(previous) ? "cached" : "seed",
      sourceUrl,
      recordCount: cached.length,
      rawRecordCount: cachedRaw.length,
      note: "Network refresh skipped by offline mode",
    };
  }

  try {
    const loaded = await liveLoader();
    return {
      records: loaded.records,
      rawRecords: loaded.rawRecords,
      status: "live",
      sourceUrl,
      recordCount: loaded.records.length,
      ...loaded.details,
    };
  } catch (error) {
    const fallback = usableRecords(previous) ? previous : seed;
    const fallbackRaw = Array.isArray(previousRaw) ? previousRaw : [];
    const status = usableRecords(previous) ? "cached" : "seed";
    const note = messageOf(error);
    console.warn(`[government-data] ${name} refresh failed; using ${status}: ${note}`);
    if (STRICT) throw error;
    return {
      ...previousDetails,
      records: fallback,
      rawRecords: fallbackRaw,
      status,
      sourceUrl,
      recordCount: fallback.length,
      rawRecordCount: fallbackRaw.length,
      note,
    };
  }
}

async function main() {
  const seedCourses = await readJson(path.join(DATA_DIR, "courses.json"), []);
  const seedJobs = await readJson(path.join(DATA_DIR, "jobs.json"), []);
  if (!usableRecords(seedCourses) || !usableRecords(seedJobs)) {
    throw new Error("Seed course and job catalogs are required for safe fallback");
  }

  const previousCourses = await readJson(path.join(GENERATED_DIR, "courses.json"), null);
  const previousJobs = await readJson(path.join(GENERATED_DIR, "jobs.json"), null);
  const previousRawCourses = await readJson(
    path.join(GENERATED_DIR, "courses.raw.json"),
    null,
  );
  const previousRawJobs = await readJson(
    path.join(GENERATED_DIR, "jobs.raw.json"),
    null,
  );
  const previousMetadata = await readJson(
    path.join(GENERATED_DIR, "metadata.json"),
    {},
  );
  const rebuiltCachedJobs = usableRecords(previousRawJobs)
    ? cleanNcsJobs(previousRawJobs)
    : previousJobs;

  console.log(
    `[government-data] Refreshing PM-AJAY courses and NCS jobs${OFFLINE ? " (offline)" : ""}...`,
  );
  const [courses, jobs] = await Promise.all([
    refreshSource({
      name: "PM-AJAY courses",
      liveLoader: () => loadPmAjay(seedCourses),
      previous: previousCourses,
      previousDetails: {
        ...previousMetadata?.sources?.courses,
        upstreamRows: Array.isArray(previousRawCourses)
          ? previousRawCourses.length
          : undefined,
        rawRecordCount: Array.isArray(previousRawCourses)
          ? previousRawCourses.length
          : 0,
      },
      previousRaw: previousRawCourses,
      seed: seedCourses,
      sourceUrl: PM_AJAY_URL,
    }),
    refreshSource({
      name: "NCS jobs",
      liveLoader: loadNcs,
      previous: rebuiltCachedJobs,
      previousDetails: {
        ...previousMetadata?.sources?.jobs,
        fetchedPages: Array.isArray(previousRawJobs)
          ? Math.ceil(previousRawJobs.length / NCS_PAGE_SIZE)
          : undefined,
        upstreamPostings: Array.isArray(previousRawJobs)
          ? previousRawJobs.length
          : undefined,
        rawRecordCount: Array.isArray(previousRawJobs)
          ? previousRawJobs.length
          : 0,
        totalAvailable:
          previousMetadata?.sources?.jobs?.totalAvailable ??
          (Array.isArray(previousRawJobs) ? previousRawJobs.length : null),
      },
      previousRaw: previousRawJobs,
      seed: seedJobs,
      sourceUrl: NCS_SEARCH_URL,
    }),
  ]);

  await Promise.all([
    atomicWriteJson("courses.json", courses.records),
    atomicWriteJson("courses.raw.json", courses.rawRecords),
    atomicWriteJson("jobs.json", jobs.records),
    atomicWriteJson("jobs.raw.json", jobs.rawRecords),
    atomicWriteJson("metadata.json", {
      generatedAt: new Date().toISOString(),
      mode: OFFLINE ? "offline" : "refresh",
      sources: {
        courses: withoutRecords(courses),
        jobs: withoutRecords(jobs),
      },
    }),
  ]);

  console.log(
    `[government-data] Ready: ${courses.recordCount} courses (${courses.status}), ` +
      `${jobs.recordCount} job locations (${jobs.status}).`,
  );
}

function withoutRecords(source) {
  return Object.fromEntries(
    Object.entries(source).filter(
      ([key]) => key !== "records" && key !== "rawRecords",
    ),
  );
}

await main();
