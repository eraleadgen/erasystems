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

function Shell({
  children,
  title = "Your business",
  status,
  role,
}: {
  children: React.ReactNode;
  title?: string;
  status?: { label: string; tone: "live" | "waiting" | "halted" };
  role?: string;
}) {
  return (
    <AppShell title={title} {...(status ? { status } : {})} {...(role ? { role } : {})}>
      {children}
    </AppShell>
  );
}

const TONE: Record<MyBusiness["lifecycle"], "live" | "waiting" | "halted"> = {
  pending_payment: "waiting",
  expired: "waiting",
  suspended: "halted",
  active: "live",
};


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
        <div className="era-skeleton h-28 w-full" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="era-skeleton h-24 w-full" />
          ))}
        </div>
        <div className="era-skeleton h-44 w-full" />
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="era-card p-6">
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        </div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <div className="era-card p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">No business yet</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            You haven&apos;t finished business setup. Everything you enter saves as you go.
          </p>
          <Link
            to="/onboarding"
            className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Continue setup
          </Link>
        </div>
      </Shell>
    );
  }

  const copy = STATE_COPY[data.lifecycle];
  const reservedUntil = formatDate(data.slugReservedUntil);
  const paid = data.lifecycle === "active";
  const steps: { label: string; state: StepState }[] = [
    { label: "Account created", state: "done" },
    { label: "Business setup", state: "done" },
    { label: "Payment", state: paid ? "done" : "current" },
    { label: "Live", state: paid && data.isActive ? "done" : "upcoming" },
  ];

  return (
    <Shell title={data.name} status={{ label: copy.label, tone: TONE[data.lifecycle] }} role={data.role}>
      <StatusBanner
        tone={TONE[data.lifecycle]}
        label={copy.label}
        headline={copy.headline}
        body={copy.body}
        {...(data.lifecycle === "pending_payment" && reservedUntil
          ? {
              footnote: (
                <>
                  Your address <code className="text-foreground">{data.slug}</code> is reserved
                  until {reservedUntil}.
                </>
              ),
            }
          : {})}
      />

      <SetupProgress steps={steps} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Plan" value={data.planTier} />
        <StatTile label="Services" value={String(data.serviceCount)} hint="in your catalog" />
        <StatTile label="Timezone" value={data.timezone} />
        <StatTile label="Site published" value={data.isActive ? "Yes" : "Not yet"} />
      </div>

      {(data.lifecycle === "pending_payment" || data.lifecycle === "expired") && (
        <CheckoutPanel canPay={data.role === "owner" || data.role === "admin"} />
      )}

      <section className="era-card px-5 py-2">
        <CopyRow label="Web address" value={data.slug} />
        <div className="era-hairline border-t" />
        <div className="flex items-center justify-between gap-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Your role
            </p>
            <p className="mt-1 text-sm text-foreground">{data.role}</p>
          </div>
          <Link to="/onboarding" className="era-ghost-button">
            Edit setup
          </Link>
        </div>
      </section>
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
    <div className="era-card p-6 sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <p className="text-base font-semibold tracking-tight text-foreground">
          Activate your business
        </p>
        <span className="era-chip">Secure checkout</span>
      </div>

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
        <div className="mt-4 space-y-2">
          <div className="era-skeleton h-4 w-2/3" />
          <div className="era-skeleton h-4 w-1/2" />
        </div>
      ) : !terms || terms.totalCents <= 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Your pricing hasn&apos;t been finalised yet. Your ERA Systems representative will set it
          before checkout opens.
        </p>
      ) : (
        <>
          <ul className="mt-5 space-y-0 text-sm">
            <li className="era-hairline flex items-center justify-between gap-4 border-b py-2.5">
              <span className="text-foreground">{terms.planTier} plan</span>
              <span className="text-muted-foreground">
                {formatMoney(terms.subscriptionPriceCents)} {intervalLabel(terms.billingInterval)}
              </span>
            </li>
            {terms.setupFeeCents > 0 && (
              <li className="era-hairline flex items-center justify-between gap-4 border-b py-2.5">
                <span className="text-foreground">Setup fee</span>
                <span className="text-muted-foreground">{formatMoney(terms.setupFeeCents)}</span>
              </li>
            )}
            {terms.addons.map((addon) => (
              <li
                key={addon.addon}
                className="era-hairline flex items-center justify-between gap-4 border-b py-2.5"
              >
                <span className="text-foreground">{ADDON_LABELS[addon.addon]}</span>
                <span className="text-muted-foreground">
                  {formatMoney(addon.priceCents)} {intervalLabel(addon.billingInterval)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-baseline justify-between gap-4">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Due today
            </span>
            <span className="text-2xl font-semibold tracking-tight text-foreground">
              {formatMoney(terms.totalCents)}
            </span>
          </div>
          {canPay ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                checkout.mutate();
              }}
              disabled={checkout.isPending}
              className="mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
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
