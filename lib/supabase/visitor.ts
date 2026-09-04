import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "pm_ajay_visitor";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60;

export async function getVisitorId() {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  return value && UUID_PATTERN.test(value) ? value : null;
}

export async function getOrCreateVisitorId() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(COOKIE_NAME)?.value;
  if (existing && UUID_PATTERN.test(existing)) return existing;

  const visitorId = randomUUID();
  cookieStore.set(COOKIE_NAME, visitorId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ONE_YEAR_IN_SECONDS,
    path: "/",
  });
  return visitorId;
}
