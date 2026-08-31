import { createFileRoute } from "@tanstack/react-router";

/**
 * TEMPORARY DIAGNOSTIC ROUTE — remove before launch.
 *
 * Reports exactly what hostname signals reach the Cloudflare Worker so tenant
 * resolution can be written against a measured, trustworthy source rather than
 * an assumption. Returns no secrets: only request URL and inbound headers, with
 * anything auth/cookie shaped redacted.
 */

const REDACT = /^(cookie|authorization|proxy-authorization|x-lovable-identity-token)$/i;

export const Route = createFileRoute("/api/public/whoami")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
          headers[key] = REDACT.test(key) ? "[redacted]" : value;
        });

        return Response.json(
          {
            requestUrl: request.url,
            urlHostname: url.hostname,
            urlProtocol: url.protocol,
            headerHost: request.headers.get("host"),
            headerXForwardedHost: request.headers.get("x-forwarded-host"),
            headerXForwardedProto: request.headers.get("x-forwarded-proto"),
            headerXForwardedFor: request.headers.get("x-forwarded-for"),
            headerOrigin: request.headers.get("origin"),
            headerReferer: request.headers.get("referer"),
            cfRay: request.headers.get("cf-ray"),
            allHeaders: headers,
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
