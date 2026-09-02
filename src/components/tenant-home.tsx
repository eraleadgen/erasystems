import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getMyEntitlements } from "@/lib/entitlements.functions";
import type { ResolvedTenant } from "@/lib/tenant.functions";
import {
  ALL_FEATURES,
  FEATURE_INTRODUCED_IN,
  FEATURE_LABELS,
  hasFeature,
} from "@/lib/entitlements";

export type TenantService = {
  id: string;
  name: string;
  description: string | null;
  base_price_cents: number;
  duration_minutes: number;
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

/**
 * Tenant-internal commercial information. Fetched client-side through an
 * authenticated, membership-scoped server fn — never in the public SSR loader.
 */
function EntitlementMatrix({ businessId }: { businessId: string }) {
  const fetchEntitlements = useServerFn(getMyEntitlements);

  const { data: hasSession } = useQuery({
    queryKey: ["has-session"],
    queryFn: async () => Boolean((await supabase.auth.getSession()).data.session),
    retry: false,
  });

  const { data } = useQuery({
    queryKey: ["my-entitlements", businessId],
    queryFn: () => fetchEntitlements({ data: { businessId } }).catch(() => null),
    enabled: hasSession === true,
    retry: false,
  });

  if (!data) return null;

  return (
    <>
      <h2 className="mt-14 text-lg font-semibold text-foreground">
        Plan entitlements — {data.tier}
      </h2>
      <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
        Visible to this business&apos;s own team only. Resolved from{" "}
        <code className="text-foreground">plan_tier_features</code>; add-ons live in a separate
        table keyed on <code className="text-foreground">business_id</code> and are never granted by
        a tier.
      </p>
      <ul className="mt-4 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
        {ALL_FEATURES.map((feature) => {
          const enabled = hasFeature(data, feature);
          return (
            <li key={feature} className="flex items-center justify-between gap-4 bg-card px-5 py-3">
              <span
                className={
                  enabled ? "text-sm text-foreground" : "text-sm text-muted-foreground line-through"
                }
              >
                {FEATURE_LABELS[feature]}
              </span>
              <span className="shrink-0 text-[10px] uppercase tracking-widest text-muted-foreground">
                {enabled ? "included" : FEATURE_INTRODUCED_IN[feature]}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function TenantHome({
  tenant,
  services,
}: {
  tenant: ResolvedTenant | null;
  services: TenantService[];
}) {
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
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <p className="text-xs font-medium uppercase tracking-[0.2em]" style={{ color: accent }}>
          Resolved server-side
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">{tenant.name}</h1>
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
            <Link to="/demo/tenant" search={{ tenant: "apex-detail" }} className="underline">
              ?tenant=apex-detail
            </Link>{" "}
            or{" "}
            <Link to="/demo/tenant" search={{ tenant: "northwind-hvac" }} className="underline">
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
