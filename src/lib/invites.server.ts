/**
 * Server-only invite primitives.
 *
 * Blocked from client bundles by the *.server.* filename. Everything that
 * touches the token plaintext, the token hash, or the elevated client lives
 * here — never in a *.functions.ts module scope.
 *
 * Elevated access: creating an auth user needs the service-role client. Per
 * docs/elevated-access.md, that call is reached only after an invite row has
 * been atomically consumed, uses no tenant data, and trusts no client-supplied
 * identifier (the email comes from the invite row, not the submitted form).
 */

const TOKEN_BYTES = 32;

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 32 bytes of CSPRNG output, base64url encoded. ~256 bits of entropy. */
export function generateInviteToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** Only this value is ever persisted. The plaintext is shown once and dropped. */
export async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Uniform failure delay so a bad token, a used token and an expired token look alike. */
export async function failureDelay(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 300));
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function expiryFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** Timing-safe comparison for the invited vs submitted email. */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
