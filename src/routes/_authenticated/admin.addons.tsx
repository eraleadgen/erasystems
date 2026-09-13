import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { listVisibleBusinesses } from "@/lib/business.functions";
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

export const Route = createFileRoute("/_authenticated/admin/addons")({
  head: () => ({
    meta: [
      { title: "Add-on management | ERA Systems" },
      {
        name: "description",
        content:
          "Platform staff activate Ad Management and White-Label Branding per client and set the per-client amount.",
      },
      { property: "og:title", content: "Add-on management | ERA Systems" },
      {
        property: "og:description",
        content: "Add-ons are independent of plan tier and priced individually per business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AddonsAdmin,
  errorComponent: ({ error }) => (
    <AppShell title="Add-ons" variant="staff">
      <div className="era-card p-6">
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    </AppShell>
  ),
});

function AddonsAdmin() {
  const fetchAddons = useServerFn(getBusinessAddons);
  const fetchBusinesses = useServerFn(listVisibleBusinesses);
  const saveAddon = useServerFn(saveBusinessAddon);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  // Anonymous visitors carry no bearer token; the authenticated fn would 401
  // and blank the page, so only query once a session exists.
  const { data: hasSession } = useQuery({
    queryKey: ["has-session"],
    queryFn: async () => Boolean((await supabase.auth.getSession()).data.session),
    retry: false,
  });

  const businessesQuery = useQuery({
    queryKey: ["visible-businesses"],
    queryFn: () => fetchBusinesses(),
    enabled: hasSession === true,
    retry: false,
  });

  const businesses = businessesQuery.data ?? [];
  const businessId = selected ?? businesses[0]?.id ?? null;
  const business = businesses.find((b) => b.id === businessId) ?? null;

  const addonsQuery = useQuery({
    queryKey: ["business-addons", businessId],
    queryFn: () => fetchAddons({ data: { businessId: businessId! } }),
    enabled: Boolean(businessId),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (input: {
      addon: AddonKind;
      priceCents: number;
      billingInterval: BillingInterval;
      isActive: boolean;
    }) => saveAddon({ data: { businessId: businessId!, ...input } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["business-addons", businessId] }),
  });

  const rows = addonsQuery.data ?? [];

  return (
    <AppShell
      title={business ? `Add-ons, ${business.name}` : "Add-ons"}
      variant="staff"
      role="Platform staff"
    >
      <p className="max-w-2xl text-sm text-muted-foreground">
        Add-ons are independent of plan tier: a business on any tier can have either add-on active
        or not. Amounts are entered per client; there is no platform-wide rate.
      </p>

      {hasSession === false ? (
        <div className="era-card p-6">
          <p className="text-sm text-muted-foreground">
            Add-on records are readable only to members of a business and platform staff. Sign in
            with an authorized account to view or edit them.
          </p>
        </div>
      ) : businessesQuery.isLoading ? (
        <div className="era-skeleton h-24 w-full" />
      ) : businesses.length === 0 ? (
        <div className="era-card p-6">
          <p className="text-sm text-muted-foreground">
            No businesses yet. A business appears here once an invited client completes setup.
          </p>
        </div>
      ) : (
        <>
          <div className="era-card flex flex-wrap items-end gap-3 p-5">
            <label className="text-xs text-muted-foreground">
              Business
              <select
                value={businessId ?? ""}
                onChange={(e) => setSelected(e.target.value)}
                className="mt-1 block min-w-64 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            {business && (
              <span className="era-chip">
                {business.planTier} · {business.lifecycle.replace("_", " ")}
              </span>
            )}
          </div>

          {addonsQuery.isError && (
            <p className="text-sm text-destructive">
              {(addonsQuery.error as Error).message}
            </p>
          )}

          {addonsQuery.isSuccess && (
            <div className="space-y-4">
              {ALL_ADDONS.map((addon) => (
                <AddonRow
                  key={`${businessId}-${addon}`}
                  addon={addon}
                  existing={rows.find((r) => r.addon === addon) ?? null}
                  saving={mutation.isPending}
                  onSave={(input) => mutation.mutate({ addon, ...input })}
                />
              ))}
              {mutation.isError && (
                <p className="text-xs text-destructive">
                  {(mutation.error as Error).message}, only platform staff may write add-on
                  records.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </AppShell>
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
    <div className="era-card p-5">
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
