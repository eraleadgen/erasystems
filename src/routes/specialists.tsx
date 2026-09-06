import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { checkTenantFeature } from "@/lib/entitlements.functions";
import { resolveTenant } from "@/lib/tenant.functions";
import { TenantSurface } from "@/components/tenant-surface";

const searchSchema = z.object({
  tenant: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export const Route = createFileRoute("/specialists")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ tenant: search.tenant }),
  loader: async ({ deps }) => {
    const tenant = await resolveTenant({ data: { tenant: deps.tenant } });
    if (!tenant || tenant.isPlatformHost) return { tenant: null, allowed: false };
    const allowed = await checkTenantFeature({
      data: { businessId: tenant.businessId, feature: "specialist_portal" },
    });
    // Plan gating is UX only; the underlying tables stay RLS-gated per business.
    return { tenant, allowed };
  },
  head: ({ loaderData }) => {
    // On a client's own domain the portal carries the client's name, not ERA's.
    const brand = loaderData?.tenant?.name ?? "ERA Systems";
    const title = `Specialist portal | ${brand}`;
    return {
      meta: [
        { title },
        {
          name: "description",
          content: "Schedules, assigned jobs and availability for this business's specialists.",
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: "Schedules, assigned jobs and availability for this business's specialists.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },

  component: Specialists,
  errorComponent: ({ error }) => (
    <div className="era-app flex min-h-screen items-center justify-center bg-background p-8">
      <p className="text-sm text-destructive">{error.message}</p>
    </div>
  ),
});

function Specialists() {
  const { tenant, allowed } = Route.useLoaderData();
  return (
    <TenantSurface
      kicker="Growth feature"
      title={tenant ? `${tenant.name} specialist portal` : "Specialist portal"}
      tenant={tenant}
      allowed={allowed}
      feature="specialist_portal"
      body="Schedules, assigned jobs and availability for this business's specialists."
    />
  );
}
