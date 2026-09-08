import { createFileRoute } from "@tanstack/react-router";

import { appIdentityById, monogram } from "@/lib/app-identity.server";

/**
 * Per-business app icon.
 *
 * - Logo uploaded  → that business's own logo.
 * - No logo yet    → a generated monogram tile in that business's brand colours,
 *                    with safe padding on the `maskable` variant so Android does
 *                    not crop the initials.
 *
 * Returns nothing at all unless the business is live with the Downloadable Apps
 * add-on active, so an icon can never be fetched for a client who is not entitled.
 */
function monogramSvg(text: string, bg: string, fg: string, maskable: boolean) {
  const pad = maskable ? 0.62 : 0.78; // maskable keeps the initials inside the safe zone
  const size = 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${text}">
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : 96}" fill="${bg}"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle"
    font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    font-weight="700" font-size="${Math.round(size * 0.42 * pad)}" fill="${fg}">${text}</text>
</svg>`;
}

function safeColor(value: string | null, fallback: string) {
  return value && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : fallback;
}

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

        const identity = await appIdentityById(params.businessId);
        if (!identity) return new Response("Not found", { status: 404 });

        if (identity.logoUrl) {
          return Response.redirect(identity.logoUrl, 302);
        }

        const bg = safeColor(identity.brandPrimary, "#0f766e");
        const svg = monogramSvg(monogram(identity.name), bg, "#ffffff", variant === "maskable");
        return new Response(svg, {
          headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "private, max-age=300",
          },
        });
      },
    },
  },
});
