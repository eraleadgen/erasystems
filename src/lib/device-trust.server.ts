/**
 * Server-only "remembered device" cookie for the email-code sign-in check.
 * The cookie holds the user id and an expiry, signed with DEVICE_TRUST_SECRET,
 * so it cannot be forged or moved to another account.
 */
import { createHash, createHmac, randomInt, timingSafeEqual } from "crypto";

export const DEVICE_COOKIE = "era_device";
export const DEVICE_TTL_SECONDS = 30 * 24 * 60 * 60;
export const DEVICE_REQUIRED = "DEVICE_VERIFICATION_REQUIRED";

function secret(): string {
  const s = process.env["DEVICE_TRUST_SECRET"];
  if (!s) throw new Error("DEVICE_TRUST_SECRET is not configured");
  return s;
}

function b64(s: string) {
  return Buffer.from(s).toString("base64url");
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function makeDeviceToken(userId: string, ttlSeconds = DEVICE_TTL_SECONDS): string {
  const payload = b64(JSON.stringify({ u: userId, e: Math.floor(Date.now() / 1000) + ttlSeconds }));
  return `${payload}.${sign(payload)}`;
}

export function deviceTrustedFor(token: string | undefined | null, userId: string): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { u?: string; e?: number };
    return data.u === userId && typeof data.e === "number" && data.e > Date.now() / 1000;
  } catch {
    return false;
  }
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

export function deviceCookieHeader(userId: string, remember: boolean): string {
  const token = makeDeviceToken(userId, remember ? DEVICE_TTL_SECONDS : 12 * 60 * 60);
  const maxAge = remember ? `; Max-Age=${DEVICE_TTL_SECONDS}` : "";
  return `${DEVICE_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax${maxAge}`;
}

/** Unverified read of the JWT subject; only used to pick which cookie identity to compare. */
export function jwtSubject(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const data = JSON.parse(Buffer.from(part, "base64url").toString()) as { sub?: string };
    return data.sub ?? null;
  } catch {
    return null;
  }
}

export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(userId: string, code: string): string {
  return createHash("sha256").update(`${userId}:${code}:${secret()}`).digest("hex");
}

/** Verifies the bearer token with the auth server and returns the user. */
export async function userFromRequest(request: Request): Promise<{ id: string; email: string } | null> {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user?.email) return null;
  return { id: data.user.id, email: data.user.email };
}
