import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";

import { getTenantEntitlements } from "@/lib/entitlements.functions";
import { resolveTenant } from "@/lib/tenant.functions";
import { hasFeature } from "@/lib/entitlements";

const searchSchema = z.object({
  tenant: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export const Route = createFileRoute("/portal")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ tenant: search.tenant }),
  loader: async ({ deps }) => {
    const tenant = await resolveTenant({ data: { tenant: deps.tenant } });
    if (!tenant) throw notFound();
    const entitlements = await getTenantEntitlements({ data: { businessId: tenant.businessId } });
    // Growth+ feature. Gating is UX; the portal's own tables stay RLS-gated.
    if (!hasFeature(entitlements, "customer_portal")) throw notFound();
    return { tenant };
  },
  head: () => ({
    meta: [
      { title: "Customer portal — ERA Systems" },
      {
        name: "description",
        content:
          "Member portal for customers of a Growth or Enterprise tier business on ERA Systems.",
      },
      { property: "og:title", content: "Customer portal — ERA Systems" },
      {
        property: "og:description",
        content: "Bookings, invoices and history for members of this business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Portal,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center p-8">
      <p className="text-sm text-destructive">{error.message}</p>
    </div>
  ),
});

function Portal() {
  const { tenant } = Route.useLoaderData();
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Growth feature</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        {tenant.name} customer portal
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        This route exists only for tenants whose plan includes{" "}
        <code className="text-foreground">customer_portal</code>. On a Basic tenant it returns 404.
      </p>
    </main>
  );
}
