import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { getMyBusiness, type MyBusiness } from "@/lib/business.functions";
import { createCheckoutSession, getMyTerms, verifyMyPayment } from "@/lib/payments.functions";
import { ADDON_LABELS, formatMoney } from "@/lib/entitlements";
import { intervalLabel } from "@/lib/payments";
import { AppShell } from "@/components/app/app-shell";
import { StatusBanner } from "@/components/app/status-banner";
import { StatTile, CopyRow } from "@/components/app/stat-tile";
import { SetupProgress, type StepState } from "@/components/app/setup-progress";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Business dashboard | ERA Systems" },
      {
        name: "description",
        content:
          "Status of your ERA Systems business: setup progress, plan state, and what happens before you go live.",
      },
      { property: "og:title", content: "Business dashboard | ERA Systems" },
      {
        property: "og:description",
        content: "Setup summary and go-live status for your ERA Systems business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (
    search: Record<string, unknown>,
  ): { session?: string; checkout?: string } => ({
    ...(typeof search["session"] === "string" ? { session: search["session"] } : {}),
    ...(typeof search["checkout"] === "string" ? { checkout: search["checkout"] } : {}),
  }),
  component: Dashboard,
  errorComponent: ({ error }) => (
    <Shell>
      <p className="text-sm text-destructive">{error.message}</p>
    </Shell>
  ),
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <div className="space-y-6">{children}</div>
    </main>
  );
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const STATE_COPY: Record<
  MyBusiness["lifecycle"],
  { label: string; headline: string; body: string }
> = {
  pending_payment: {
    label: "Awaiting payment",
    headline: "Your setup is saved, you're not live yet",
    body: "Everything below is stored on your account. Billing is the next step; once payment is complete your site goes live at your reserved address.",
  },
  expired: {
    label: "Reservation lapsed",
    headline: "Your setup is safe, but the address was released",
    body: "Nothing was deleted, your details, catalog and team are intact. The web address you reserved has been freed for other businesses, so a new one is assigned when you complete payment.",
  },
  suspended: {
    label: "Suspended",
    headline: "This business is currently suspended",
    body: "Your data is intact and the site is offline. Your ERA Systems representative can restore it.",
  },
  active: {
    label: "Live",
    headline: "Your business is live",
    body: "Your site is published and serving customers.",
  },
};

function Dashboard() {
  const fetchBusiness = useServerFn(getMyBusiness);
  const { data, isPending, error } = useQuery({
    queryKey: ["my-business"],
    queryFn: () => fetchBusiness(),
    retry: false,
  });

  if (isPending) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">Loading your business…</p>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold text-foreground">No business yet</h1>
        <p className="text-sm text-muted-foreground">
          You haven&apos;t finished business setup. Everything you enter saves as you go.
        </p>
        <Link
          to="/onboarding"
          className="inline-block rounded-md border border-border px-4 py-2 text-sm text-foreground underline-offset-4 hover:underline"
        >
          Continue setup
        </Link>
      </Shell>
    );
  }

  const copy = STATE_COPY[data.lifecycle];
  const reservedUntil = formatDate(data.slugReservedUntil);

  return (
    <Shell>
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{copy.label}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{data.name}</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
      </div>

      <div className="rounded-lg border border-border bg-card px-5 py-4">
        <p className="text-sm font-medium text-foreground">{copy.headline}</p>
        {data.lifecycle === "pending_payment" && reservedUntil && (
          <p className="mt-2 text-xs text-muted-foreground">
            Your address <code className="text-foreground">{data.slug}</code> is reserved until{" "}
            {reservedUntil}.
          </p>
        )}
      </div>

      {(data.lifecycle === "pending_payment" || data.lifecycle === "expired") && (
        <CheckoutPanel canPay={data.role === "owner" || data.role === "admin"} />
      )}


      <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
        {[
          ["Web address", data.slug],
          ["Plan", data.planTier],
          ["Timezone", data.timezone],
          ["Services in catalog", String(data.serviceCount)],
          ["Your role", data.role],
          ["Site published", data.isActive ? "Yes" : "No"],
        ].map(([label, value]) => (
          <div key={label} className="bg-card px-5 py-4">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-all text-sm text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </Shell>
  );
}

/**
 * Checkout for a business that is waiting on payment.
 *
 * The amount shown is the server's own computation from the staff-agreed terms , 
 * it is never sent to the server, and the redirect back from the processor is
 * treated as a hint only: the state below reflects webhook + live API
 * verification, not the URL the browser landed on.
 */
function CheckoutPanel({ canPay }: { canPay: boolean }) {
  const search = useSearch({ from: "/_authenticated/dashboard" });
  const fetchTerms = useServerFn(getMyTerms);
  const startCheckout = useServerFn(createCheckoutSession);
  const verify = useServerFn(verifyMyPayment);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const termsQuery = useQuery({
    queryKey: ["my-terms"],
    queryFn: () => fetchTerms(),
    retry: false,
  });

  const checkout = useMutation({
    mutationFn: () => startCheckout(),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError: (err: Error) => setError(err.message),
  });

  // Returning from the processor: reconcile in case the webhook hasn't landed yet.
  const reconcile = useMutation({
    mutationFn: (sessionId: string) => verify({ data: { sessionId } }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-business"] });
    },
  });

  useEffect(() => {
    if (search.session) reconcile.mutate(search.session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.session]);

  const terms = termsQuery.data;

  return (
    <div className="rounded-lg border border-border bg-card px-5 py-5">
      <p className="text-sm font-medium text-foreground">Activate your business</p>

      {search.checkout === "cancelled" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Checkout was cancelled, nothing was charged. You can start again below.
        </p>
      )}

      {search.session && (
        <p className="mt-2 text-xs text-muted-foreground">
          {reconcile.isPending
            ? "Confirming your payment with the processor…"
            : reconcile.data?.status === "paid"
              ? "Payment confirmed. Your business is being activated."
              : "We haven't been able to confirm this payment yet. It can take a moment, refresh shortly."}
        </p>
      )}

      {termsQuery.isPending ? (
        <p className="mt-3 text-xs text-muted-foreground">Loading your agreed terms…</p>
      ) : !terms || terms.totalCents <= 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Your pricing hasn&apos;t been finalised yet. Your ERA Systems representative will set it
          before checkout opens.
        </p>
      ) : (
        <>
          <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
            <li>
              {terms.planTier} plan, {formatMoney(terms.subscriptionPriceCents)}{" "}
              {intervalLabel(terms.billingInterval)}
            </li>
            {terms.setupFeeCents > 0 && <li>Setup fee, {formatMoney(terms.setupFeeCents)}</li>}
            {terms.addons.map((addon) => (
              <li key={addon.addon}>
                {ADDON_LABELS[addon.addon]}, {formatMoney(addon.priceCents)}{" "}
                {intervalLabel(addon.billingInterval)}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm font-medium text-foreground">
            Due today: {formatMoney(terms.totalCents)}
          </p>
          {canPay ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                checkout.mutate();
              }}
              disabled={checkout.isPending}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {checkout.isPending ? "Opening secure checkout…" : "Pay and go live"}
            </button>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Only the business owner can complete payment.
            </p>
          )}
        </>
      )}

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
    </div>
  );
}
