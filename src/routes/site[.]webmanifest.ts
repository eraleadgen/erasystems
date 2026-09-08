import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";

import { appIdentityForHost } from "@/lib/app-identity.server";
import { getRequestHostname, normalizeHostname } from "@/lib/tenant-hostname";
import { buildManifest } from "@/lib/app-manifest";

/**
 * The customer-facing installable app, built per request from the business that
 * owns the incoming hostname. There is no static manifest: an unknown host, a
 * host with no business, an inactive business, or a business without the
 * Downloadable Apps add-on all get a plain 404 and no app identity.
 */
export const Route = createFileRoute("/site.webmanifest")({
  server: {
    handlers: {
      GET: async () => {
        const hostname = normalizeHostname(getRequestHostname(getRequest()));
        if (!hostname) return new Response("Not found", { status: 404 });

        const identity = await appIdentityForHost(hostname);
        if (!identity) return new Response("Not found", { status: 404 });

        return Response.json(buildManifest(identity, "customer"), {
          headers: {
            "Content-Type": "application/manifest+json; charset=utf-8",
            "Cache-Control": "private, max-age=300",
          },
        });
      },
    },
  },
});
