import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { resolveTenant, getTenantServices } from "@/lib/tenant.functions";
import { getMyEntitlements } from "@/lib/entitlements.functions";
import {
  ALL_FEATURES,
  FEATURE_INTRODUCED_IN,
  FEATURE_LABELS,
  hasFeature,
} from "@/lib/entitlements";

const searchSchema = z.object({
  tenant: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ tenant: search.tenant }),
  loader: async ({ deps }) => {
    const tenant = await resolveTenant({ data: { tenant: deps.tenant } });
    const services = tenant
      ? await getTenantServices({ data: { businessId: tenant.businessId } })
      : [];
    return { tenant, services };
  },


  head: () => ({
    meta: [
      { title: "ERA Systems — Tenant Isolation Layer" },
      {
        name: "description",
        content:
          "Server-side hostname resolution and Postgres row-level security powering multi-tenant service businesses on ERA Systems.",
      },
      { property: "og:title", content: "ERA Systems — Tenant Isolation Layer" },
      {
        property: "og:description",
        content:
          "Every request resolves its business from the edge-injected hostname before render; every row is gated by RLS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <p className="max-w-md text-sm text-destructive">{error.message}</p>
    </div>
  ),
});

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function Index() {
  const { tenant, services, entitlements } = Route.useLoaderData();

  if (!tenant) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold text-foreground">Site not configured</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This hostname isn&apos;t mapped to a business. Resolution never falls back to a default
            tenant.
          </p>
        </div>
      </main>
    );
  }

  const accent = tenant.brandAccent ?? undefined;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <span
              className="inline-block size-3 rounded-sm"
              style={{ backgroundColor: tenant.brandPrimary ?? undefined }}
              aria-hidden
            />
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {tenant.name}
            </span>
          </div>
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            {tenant.planTier}
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <p className="text-xs font-medium uppercase tracking-[0.2em]" style={{ color: accent }}>
          Resolved server-side
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
          {tenant.name}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          This page was rendered for business <code className="text-foreground">{tenant.slug}</code>,
          resolved from the incoming hostname inside the worker before any markup was produced. Every
          row below came back through row-level security keyed on{" "}
          <code className="text-foreground">business_id</code>.
        </p>

        <dl className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
          {[
            ["Hostname seen by server", tenant.hostname ?? "—"],
            ["Business ID", tenant.businessId],
            ["Timezone", tenant.timezone],
          ].map(([label, value]) => (
            <div key={label} className="bg-card px-5 py-4">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-all font-mono text-xs text-foreground">{value}</dd>
            </div>
          ))}
        </dl>

        {tenant.isPlatformHost && (
          <p className="mt-6 rounded-md border border-border bg-muted px-4 py-3 text-xs text-muted-foreground">
            Platform hostname detected (preview/dev), so there is no tenant domain to resolve. Switch
            tenants with{" "}
            <Link to="/" search={{ tenant: "apex-detail" }} className="underline">
              ?tenant=apex-detail
            </Link>{" "}
            or{" "}
            <Link to="/" search={{ tenant: "northwind-hvac" }} className="underline">
              ?tenant=northwind-hvac
            </Link>
            . This override is ignored on real tenant domains.
          </p>
        )}

        <EntitlementMatrix businessId={tenant.businessId} />


        <div className="mt-6 flex flex-wrap gap-3 text-xs">
          <Link
            to="/portal"
            search={{ tenant: tenant.slug }}
            className="rounded-md border border-border px-3 py-1.5 text-foreground underline-offset-4 hover:underline"
          >
            Customer portal
          </Link>
          <Link
            to="/specialists"
            search={{ tenant: tenant.slug }}
            className="rounded-md border border-border px-3 py-1.5 text-foreground underline-offset-4 hover:underline"
          >
            Specialist portal
          </Link>
          <Link
            to="/admin/addons"
            search={{ tenant: tenant.slug }}
            className="rounded-md border border-border px-3 py-1.5 text-foreground underline-offset-4 hover:underline"
          >
            Add-on management
          </Link>
        </div>

        <h2 className="mt-14 text-lg font-semibold text-foreground">Service catalog</h2>

        <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
          {services.map((service) => (
            <li key={service.id} className="flex items-baseline justify-between gap-6 px-5 py-4">
              <div>
                <p className="text-sm font-medium text-foreground">{service.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{service.description}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-foreground">
                  {money(service.base_price_cents)}
                </p>
                <p className="text-xs text-muted-foreground">{service.duration_minutes} min</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
