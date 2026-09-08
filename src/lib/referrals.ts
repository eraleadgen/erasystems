/**
 * Referral attribution helpers (browser-safe).
 *
 * The code in a link is only ever a hint. It is re-validated server-side at
 * booking time, where a bad, switched-off, non-Enterprise or self-referring
 * code simply produces an unattributed booking.
 */

export const REFERRAL_PARAM = "ref";
const STORAGE_KEY = "era.referral";
const TTL_DAYS = 30;

export function normalizeReferralCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 24);
}

export function isReferralCodeShaped(code: string): boolean {
  return /^[A-Z0-9-]{4,24}$/.test(code);
}

/** Reads `?ref=` off the current URL and remembers it for 30 days. */
export function captureReferralFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get(REFERRAL_PARAM);
  if (!raw) return readStoredReferral();
  const code = normalizeReferralCode(raw);
  if (!isReferralCodeShaped(code)) return readStoredReferral();
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ code, expires: Date.now() + TTL_DAYS * 86_400_000 }),
    );
  } catch {
    /* private browsing — the code still applies to this page view */
  }
  return code;
}

export function readStoredReferral(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: string; expires?: number };
    if (!parsed.code || !parsed.expires || parsed.expires < Date.now()) return null;
    return normalizeReferralCode(parsed.code);
  } catch {
    return null;
  }
}

/** Deterministic-looking, human-readable code built from the business name. */
export function suggestReferralCode(businessName: string): string {
  const letters = normalizeReferralCode(businessName.replace(/[^A-Za-z0-9 ]/g, ""))
    .replace(/-/g, "")
    .slice(0, 6);
  const stem = letters.length >= 3 ? letters : "ERA";
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${stem}-${suffix}`;
}

export function referralLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/?${REFERRAL_PARAM}=${code}`;
}
