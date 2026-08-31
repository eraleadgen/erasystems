/**
 * Hostname extraction and normalization.
 *
 * MEASURED BEHAVIOUR ON THIS PLATFORM (do not "simplify" this file):
 * inside the Cloudflare Worker, `request.url` and the `Host` header both read
 * `localhost:8080`. The visitor's real hostname arrives only in `x-forwarded-host`
 * (and the RFC 7239 `forwarded` header), injected by Lovable's edge worker
 * (`cf-worker: lovableproject.com`). A client-sent `X-Forwarded-Host` was verified to be
 * OVERWRITTEN by the edge rather than passed through, so the forwarded value is
 * edge-controlled — but resolution is still never treated as authorization.
 */

/** Hostnames owned by the platform, never by a tenant. */
const PLATFORM_HOST_PATTERNS: RegExp[] = [
  /^localhost$/,
  /^127\.0\.0\.1$/,
  /(^|\.)lovable\.app$/,
  /(^|\.)lovableproject\.com$/,
  /(^|\.)lovable\.dev$/,
];

export function normalizeHostname(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let host = raw.trim().toLowerCase();
  // RFC 7239 values may be quoted; forwarded-for style lists take the first entry.
  host = host.split(",")[0]!.trim().replace(/^"|"$/g, "");
  // strip scheme if a proxy handed us an absolute URL
  host = host.replace(/^[a-z]+:\/\//, "");
  // strip path, port, trailing dot
  host = host.split("/")[0]!.split(":")[0]!.replace(/\.$/, "");
  if (!host || !/^[a-z0-9.-]+$/.test(host)) return null;
  return host;
}

/** Parse the RFC 7239 `forwarded` header for its host directive. */
function hostFromForwardedHeader(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0] ?? "";
  const match = /host=("?)([^;",]+)\1/i.exec(first);
  return match ? normalizeHostname(match[2]) : null;
}

/**
 * The visitor-facing hostname, in trust order.
 * Only edge-injected headers are consulted before falling back to the request URL.
 */
export function getRequestHostname(request: Request): string | null {
  return (
    normalizeHostname(request.headers.get("x-forwarded-host")) ??
    hostFromForwardedHeader(request.headers.get("forwarded")) ??
    normalizeHostname(request.headers.get("host")) ??
    normalizeHostname(new URL(request.url).hostname)
  );
}

export function isPlatformHostname(hostname: string | null): boolean {
  if (!hostname) return true;
  return PLATFORM_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}
