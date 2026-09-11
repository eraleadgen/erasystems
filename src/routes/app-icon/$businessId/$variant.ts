import { createFileRoute } from "@tanstack/react-router";

import { appIdentityById, monogram } from "@/lib/app-identity.server";
import { monogramPng } from "@/lib/app-icon.server";

/**
 * Per-business home-screen icon, always a real PNG (iOS ignores SVG icons,
 * which is why the install prompt previously showed a broken tile).
 *
 * - Logo uploaded  → that business's own logo file.
 * - No logo yet    → a generated monogram tile in that business's brand colour,
 *                    with extra padding on the `maskable` variant so Android
 *                    does not crop the initials.
 *
 * Returns nothing at all unless the business is live with the Downloadable Apps
 * add-on active, so an icon can never be fetched for a client who is not entitled.
 */
const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export const Route = createFileRoute("/app-icon/$businessId/$variant")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const variant = params.variant.replace(/\.(svg|png)$/, "");
        if (variant !== "any" && variant !== "maskable") {
          return new Response("Not found", { status: 404 });
        }
        if (!/^[0-9a-f-]{36}$/i.test(params.businessId)) {
          return new Response("Not found", { status: 404 });
        }

        // Entitlement gate: returns a row only for a live business with the add-on.
        const identity = await appIdentityById(params.businessId);
        if (!identity) return new Response("Not found", { status: 404 });

        const logo = identity.logoUrl;
        if (logo) {
          if (/^https?:\/\//i.test(logo)) return Response.redirect(logo, 302);

          // Uploaded logos live in a private bucket, so they are read server-side
          // and streamed back. Scoped to this business's own stored path only.
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data } = await supabaseAdmin.storage.from("onboarding-logos").download(logo);
            if (data) {
              const extension = logo.split(".").pop()?.toLowerCase() ?? "png";
              return new Response(await data.arrayBuffer(), {
                headers: {
                  "Content-Type": CONTENT_TYPES[extension] ?? "image/png",
                  "Cache-Control": "private, max-age=300",
                },
              });
            }
          } catch {
            /* fall through to the generated tile */
          }
        }

        const png = monogramPng(
          monogram(identity.name),
          identity.brandPrimary,
          variant === "maskable",
        );
        return new Response(new Uint8Array(png), {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "private, max-age=300",
          },
        });
      },
    },
  },
});
