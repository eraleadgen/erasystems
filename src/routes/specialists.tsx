import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { checkTenantFeature } from "@/lib/entitlements.functions";
import { resolveTenant } from "@/lib/tenant.functions";

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
  head: () => ({
    meta: [
      { title: "Specialist portal | ERA Systems" },
      {
        name: "description",
        content: "Employee and specialist workspace for Growth and Enterprise tier businesses.",
      },
      { property: "og:title", content: "Specialist portal | ERA Systems" },
      {
        property: "og:description",
        content: "Schedules, assigned jobs and availability for a business's specialists.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Specialists,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center p-8">
      <p className="text-sm text-destructive">{error.message}</p>
    </div>
  ),
});

function Specialists() {
  const { tenant } = Route.useLoaderData();
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Growth feature</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        {tenant.name} specialist portal
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Gated on <code className="text-foreground">specialist_portal</code>. Data inside is still
        scoped by row-level security on <code className="text-foreground">business_id</code>.
      </p>
    </main>
  );
}
