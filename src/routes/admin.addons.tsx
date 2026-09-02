import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";

import { resolveTenant } from "@/lib/tenant.functions";
import { getBusinessAddons, saveBusinessAddon } from "@/lib/entitlements.functions";
import {
  ADDON_LABELS,
  ALL_ADDONS,
  BILLING_INTERVALS,
  formatMoney,
  type AddonKind,
  type BillingInterval,
  type BusinessAddon,
} from "@/lib/entitlements";

const searchSchema = z.object({
  tenant: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export const Route = createFileRoute("/admin/addons")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ tenant: search.tenant }),
  // Public loader: resolves WHICH tenant only. Add-on rows and amounts are fetched
  // client-side through an authenticated server fn, gated by RLS.
  loader: async ({ deps }) => {
    const tenant = await resolveTenant({ data: { tenant: deps.tenant } });
    if (!tenant) throw notFound();
    return { tenant };
  },
  head: () => ({
    meta: [
      { title: "Add-on management — ERA Systems" },
      {
        name: "description",
        content:
          "Platform staff activate Ad Management and White-Label Branding per client and set the per-client amount.",
      },
      { property: "og:title", content: "Add-on management — ERA Systems" },
      {
        property: "og:description",
        content: "Add-ons are independent of plan tier and priced individually per business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AddonsAdmin,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center p-8">
      <p className="text-sm text-destructive">{error.message}</p>
    </div>
  ),
});

function AddonsAdmin() {
  const { tenant } = Route.useLoaderData();
  const fetchAddons = useServerFn(getBusinessAddons);
  const saveAddon = useServerFn(saveBusinessAddon);
  const queryClient = useQueryClient();

  // Anonymous visitors carry no bearer token; the authenticated fn would 401
  // and blank the page, so only query once a session exists.
  const { data: hasSession } = useQuery({
    queryKey: ["has-session"],
    queryFn: async () => Boolean((await supabase.auth.getSession()).data.session),
    retry: false,
  });

  const addonsQuery = useQuery({
    queryKey: ["business-addons", tenant.businessId],
    queryFn: () => fetchAddons({ data: { businessId: tenant.businessId } }),
    enabled: hasSession === true,
    retry: false,
  });


  const mutation = useMutation({
    mutationFn: (input: {
      addon: AddonKind;
      priceCents: number;
      billingInterval: BillingInterval;
      isActive: boolean;
    }) => saveAddon({ data: { businessId: tenant.businessId, ...input } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["business-addons", tenant.businessId] }),
  });

  const rows = addonsQuery.data ?? [];

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-14">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Platform staff</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        Add-ons — {tenant.name}
      </h1>
      <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
        Add-ons are independent of plan tier: this business is on{" "}
        <code className="text-foreground">{tenant.planTier}</code> and either add-on can be active
        or not regardless. Amounts are entered per client; there is no platform-wide rate.
      </p>

      {addonsQuery.isError && (
        <p className="mt-8 rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Add-on records are readable only to members of this business and platform staff. Sign in
          with an authorized account to view or edit them.
        </p>
      )}

      {addonsQuery.isSuccess && (
        <div className="mt-8 space-y-4">
          {ALL_ADDONS.map((addon) => (
            <AddonRow
              key={addon}
              addon={addon}
              existing={rows.find((r) => r.addon === addon) ?? null}
              saving={mutation.isPending}
              onSave={(input) => mutation.mutate({ addon, ...input })}
            />
          ))}
          {mutation.isError && (
            <p className="text-xs text-destructive">
              {(mutation.error as Error).message} — only platform staff may write add-on records.
            </p>
          )}
        </div>
      )}
    </main>
  );
}

function AddonRow({
  addon,
  existing,
  saving,
  onSave,
}: {
  addon: AddonKind;
  existing: BusinessAddon | null;
  saving: boolean;
  onSave: (input: {
    priceCents: number;
    billingInterval: BillingInterval;
    isActive: boolean;
  }) => void;
}) {
  const [amount, setAmount] = useState(
    existing ? (existing.priceCents / 100).toFixed(2) : "0.00",
  );
  const [interval, setInterval] = useState<BillingInterval>(
    (existing?.billingInterval as BillingInterval) ?? "monthly",
  );
  const [isActive, setIsActive] = useState(existing?.isActive ?? false);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold text-foreground">{ADDON_LABELS[addon]}</h2>
        <span className="text-xs text-muted-foreground">
          {existing
            ? `${existing.isActive ? "Active" : "Inactive"} · ${formatMoney(existing.priceCents, existing.currency)} / ${existing.billingInterval}`
            : "Not set up"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          Amount (USD)
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 block w-32 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Billing
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value as BillingInterval)}
            className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          >
            {BILLING_INTERVALS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            onSave({
              priceCents: Math.round(Number(amount || 0) * 100),
              billingInterval: interval,
              isActive,
            })
          }
          className="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}
