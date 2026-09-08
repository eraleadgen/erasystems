import { createFileRoute } from "@tanstack/react-router";

import { appIdentityById } from "@/lib/app-identity.server";
import { buildManifest } from "@/lib/app-manifest";

/**
 * The team-facing installable app (the portal). The business is named in the
 * query string, but that alone grants nothing: the identity lookup still
 * requires a live business with the Downloadable Apps add-on, and returns only
 * branding that is already public on that business's own website.
 */
export const Route = createFileRoute("/portal.webmanifest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const businessId = new URL(request.url).searchParams.get("b") ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(businessId)) {
          return new Response("Not found", { status: 404 });
        }

        const identity = await appIdentityById(businessId);
        if (!identity) return new Response("Not found", { status: 404 });

        return Response.json(buildManifest(identity, "team"), {
          headers: {
            "Content-Type": "application/manifest+json; charset=utf-8",
            "Cache-Control": "private, max-age=300",
          },
        });
      },
    },
  },
});
