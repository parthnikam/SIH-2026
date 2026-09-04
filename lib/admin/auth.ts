import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "pm_ajay_admin";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const SESSION_VERSION = "v1";

function configuredUsername() {
  return process.env.ADMIN_USERNAME || "admin";
}

function configuredPassword() {
  return process.env.ADMIN_PASSWORD || "admin@1234";
}

function sessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_PASSWORD ||
    `${configuredPassword()}:pm-ajay-admin-session`
  );
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function safeEqual(value: string, expected: string) {
  return timingSafeEqual(digest(value), digest(expected));
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("base64url");
}

function createToken(expiresAt: number) {
  const payload = `${SESSION_VERSION}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token: string | undefined) {
  if (!token) return false;

  const [version, expiresAtValue, signature, ...rest] = token.split(".");
  if (
    rest.length > 0 ||
    version !== SESSION_VERSION ||
    !expiresAtValue ||
    !signature
  ) {
    return false;
  }

  const expiresAt = Number(expiresAtValue);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const expected = sign(`${version}.${expiresAtValue}`);
  return safeEqual(signature, expected);
}

export function validateAdminCredentials(username: string, password: string) {
  const usernameMatches = safeEqual(username, configuredUsername());
  const passwordMatches = safeEqual(password, configuredPassword());
  return usernameMatches && passwordMatches;
}

export async function createAdminSession() {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, createToken(expiresAt), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires: new Date(expiresAt),
    path: "/admin",
  });
}

export async function deleteAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return verifyToken(cookieStore.get(COOKIE_NAME)?.value);
}

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    throw new Error("Unauthorized admin request");
  }
}
