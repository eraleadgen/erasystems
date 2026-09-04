/**
 * Hostname extraction and normalization.
 *
 * MEASURED BEHAVIOUR ON THIS PLATFORM (do not "simplify" this file):
 *
 * PREVIEW host (id-preview--*.lovable.app): inside the Worker, `request.url` and
 * the `Host` header both read `localhost:8080`. The visitor hostname arrives only
 * in `x-forwarded-host`, injected by Lovable's edge worker, which overwrites any
 * client-sent value.
 *
 * PUBLISHED host (*.lovable.app and custom domains) — measured 2026-08-31:
 * `Host` carries the REAL visitor hostname, and `x-forwarded-host` is passed
 * through from the client UNMODIFIED. A forged `X-Forwarded-Host` was observed
 * selecting a different tenant's public site. Therefore the forwarded headers are
 * consulted ONLY when `Host` is an internal/loopback name (i.e. the preview
 * runtime). On any real host, `Host` wins and forwarded headers are ignored.
 *
 * Resolution is still never treated as authorization: RLS gates every read.
 */

/** Loopback/internal names that mean "the real hostname is elsewhere". */
const INTERNAL_HOST_PATTERNS: RegExp[] = [
  /^localhost$/,
  /^127\.0\.0\.1$/,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
];

function isInternalHostname(host: string | null): boolean {
  return !host || INTERNAL_HOST_PATTERNS.some((p) => p.test(host));
}


/** Hostnames owned by the platform, never by a tenant. */
const PLATFORM_HOST_PATTERNS: RegExp[] = [
  /^localhost$/,
  /^127\.0\.0\.1$/,
  /(^|\.)lovable\.app$/,
  /(^|\.)lovableproject\.com$/,
  /(^|\.)lovable\.dev$/,
  // ERA's own marketing hostnames are never a tenant site.
  /^eraleadgen\.com$/,
  /^www\.eraleadgen\.com$/,
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
 *
 * `Host` (or the request URL) is authoritative whenever it is a real hostname.
 * Client-controllable forwarded headers are consulted ONLY when the connection
 * terminated on an internal/loopback name, which on this platform means the
 * preview runtime, where the edge injects and overwrites `x-forwarded-host`.
 */
export function getRequestHostname(request: Request): string | null {
  const direct =
    normalizeHostname(request.headers.get("host")) ??
    normalizeHostname(new URL(request.url).hostname);

  if (!isInternalHostname(direct)) return direct;

  return (
    normalizeHostname(request.headers.get("x-forwarded-host")) ??
    hostFromForwardedHeader(request.headers.get("forwarded")) ??
    direct
  );
}


export function isPlatformHostname(hostname: string | null): boolean {
  if (!hostname) return true;
  return PLATFORM_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}
