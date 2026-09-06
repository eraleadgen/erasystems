import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { checkTenantFeature } from "@/lib/entitlements.functions";
import { formatMoney } from "@/lib/entitlements";
import { resolveTenant } from "@/lib/tenant.functions";
import { getMyAssignedJobs, setJobStatus } from "@/lib/specialists.functions";
import { TenantSurface } from "@/components/tenant-surface";

const searchSchema = z.object({
  tenant: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

const STATUSES = ["confirmed", "completed", "no_show", "cancelled"] as const;

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
        { name: "author", content: brand },
        { property: "og:site_name", content: brand },
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

  if (!tenant || !allowed) {
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

  return <SpecialistJobs businessId={tenant.businessId} brand={tenant.name} />;
}

function SpecialistJobs({ businessId, brand }: { businessId: string; brand: string }) {
  const fetchJobs = useServerFn(getMyAssignedJobs);
  const updateStatus = useServerFn(setJobStatus);
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

  const jobs = useQuery({
    queryKey: ["my-assigned-jobs", businessId],
    queryFn: () => fetchJobs({ data: { businessId } }),
    enabled: signedIn === true,
    retry: false,
  });

  const statusMutation = useMutation({
    mutationFn: (v: { bookingId: string; status: (typeof STATUSES)[number] }) =>
      updateStatus({ data: v }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["my-assigned-jobs", businessId] }),
  });

  return (
    <main className="era-app min-h-screen bg-background px-6 py-16">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{brand}</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">Your jobs</h1>
        </header>

        {signedIn === false ? (
          <div className="era-card p-6">
            <p className="text-sm text-muted-foreground">Sign in to see the jobs assigned to you.</p>
            <a className="era-chip mt-3 inline-block" href="/auth">
              Sign in
            </a>
          </div>
        ) : jobs.isLoading || signedIn === null ? (
          <div className="era-card p-6">
            <p className="text-sm text-muted-foreground">Loading…</p>
          </div>
        ) : !jobs.data ? (
          <div className="era-card p-6">
            <p className="text-sm text-muted-foreground">
              This login isn't set up as a specialist at {brand} yet. Ask the owner to link your
              account on the Team tab.
            </p>
          </div>
        ) : myJobs.jobs.length === 0 ? (
          <div className="era-card p-6">
            <p className="text-sm text-muted-foreground">
              Nothing assigned to you right now, {myJobs.name}.
            </p>
          </div>
        ) : (
          <div className="era-card overflow-hidden">
            <ul className="divide-y divide-border/60">
              {myJobs.jobs.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{j.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(j.startsAt).toLocaleString()} · {formatMoney(j.totalCents)}
                    </p>
                    {j.notes && <p className="mt-1 text-xs text-muted-foreground">{j.notes}</p>}
                  </div>
                  <select
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                    value={STATUSES.includes(j.status as (typeof STATUSES)[number]) ? j.status : ""}
                    onChange={(e) =>
                      statusMutation.mutate({
                        bookingId: j.id,
                        status: e.target.value as (typeof STATUSES)[number],
                      })
                    }
                  >
                    <option value="" disabled>
                      {j.status}
                    </option>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
