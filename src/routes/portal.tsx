import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { checkTenantFeature } from "@/lib/entitlements.functions";
import { formatMoney } from "@/lib/entitlements";
import { resolveTenant } from "@/lib/tenant.functions";
import { claimCustomerPortal, getMyCustomerBookings } from "@/lib/customers.functions";
import { TenantSurface } from "@/components/tenant-surface";

const searchSchema = z.object({
  tenant: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  claim: z.string().max(200).optional(),
});

export const Route = createFileRoute("/portal")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ tenant: search.tenant }),
  loader: async ({ deps }) => {
    const tenant = await resolveTenant({ data: { tenant: deps.tenant } });
    if (!tenant || tenant.isPlatformHost) return { tenant: null, allowed: false };
    const allowed = await checkTenantFeature({
      data: { businessId: tenant.businessId, feature: "customer_portal" },
    });
    // Plan gating is UX only; the underlying tables stay RLS-gated per business.
    return { tenant, allowed };
  },
  head: ({ loaderData }) => {
    // On a client's own domain the portal carries the client's name, not ERA's.
    const brand = loaderData?.tenant?.name ?? "ERA Systems";
    const title = `Customer portal | ${brand}`;
    return {
      meta: [
        { title },
        { name: "author", content: brand },
        { property: "og:site_name", content: brand },
        {
          name: "description",
          content: "Bookings, invoices and history for members of this business.",
        },
        { property: "og:title", content: title },
        {
          property: "og:description",
          content: "Bookings, invoices and history for members of this business.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },

  component: Portal,
  errorComponent: ({ error }) => (
    <div className="era-app flex min-h-screen items-center justify-center bg-background p-8">
      <p className="text-sm text-destructive">{error.message}</p>
    </div>
  ),
});

function Portal() {
  const { tenant, allowed } = Route.useLoaderData();

  if (!tenant || !allowed) {
    return (
      <TenantSurface
        kicker="Growth feature"
        title={tenant ? `${tenant.name} customer portal` : "Customer portal"}
        tenant={tenant}
        allowed={allowed}
        feature="customer_portal"
        body="Bookings, invoices and history for members of this business."
      />
    );
  }

  return <CustomerPortal businessId={tenant.businessId} brand={tenant.name} />;
}

function CustomerPortal({ businessId, brand }: { businessId: string; brand: string }) {
  const { claim } = Route.useSearch();
  const fetchBookings = useServerFn(getMyCustomerBookings);
  const claimPortal = useServerFn(claimCustomerPortal);
  const queryClient = useQueryClient();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    return () => {
      active = false;
    };
  }, []);

  const account = useQuery({
    queryKey: ["my-customer-bookings", businessId],
    queryFn: () => fetchBookings({ data: { businessId } }),
    enabled: signedIn === true,
    retry: false,
  });

  const claimMutation = useMutation({
    mutationFn: (token: string) => claimPortal({ data: { token } }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["my-customer-bookings", businessId] }),
  });

  // A one-time invite link binds this login to the customer record it points at.
  useEffect(() => {
    if (signedIn && claim && account.data === null && !claimMutation.isPending) {
      claimMutation.mutate(claim);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, claim, account.data]);

  return (
    <main className="era-app min-h-screen bg-background px-6 py-16">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{brand}</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">Your account</h1>
        </header>

        {signedIn === false ? (
          <div className="era-card p-6">
            <p className="text-sm text-muted-foreground">
              Sign in to see your bookings with {brand}.
            </p>
            <a className="era-chip mt-3 inline-block" href="/auth">
              Sign in
            </a>
          </div>
        ) : account.isLoading || signedIn === null ? (
          <div className="era-card p-6">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        ) : !account.data ? (
          <div className="era-card p-6">
            <p className="text-sm text-muted-foreground">
              This login isn't linked to a customer record at {brand} yet. Use the portal link{" "}
              {brand} sent you, or contact them to have one issued.
            </p>
            {claimMutation.isSuccess && !claimMutation.data.ok && (
              <p className="mt-2 text-xs text-destructive">
                That portal link is no longer valid. Ask {brand} for a new one.
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Signed in as {acct.name}. Bookings shown here are only your own with {brand}.
            </p>
            <div className="era-card overflow-hidden">
              {acct.bookings.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No bookings on your account yet.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {acct.bookings.map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {new Date(b.startsAt).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {b.status}
                          {b.specialistName ? ` · with ${b.specialistName}` : ""}
                        </p>
                        {b.notes && <p className="mt-1 text-xs text-muted-foreground">{b.notes}</p>}
                      </div>
                      <span className="text-sm text-foreground">{formatMoney(b.totalCents)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
