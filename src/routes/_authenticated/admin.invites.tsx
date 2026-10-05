import { PLAN_PRICING } from "@/lib/pricing";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { createInvite, listInvites, revokeInvite } from "@/lib/invites.functions";
import { INVITE_TTL_DAYS, inviteStatusLabel, inviteUrl, type InviteSummary } from "@/lib/invites";
import {
  BILLING_INTERVALS,
  formatMoney,
  type BillingInterval,
  type PlanTier,
} from "@/lib/entitlements";

export const Route = createFileRoute("/_authenticated/admin/invites")({
  head: () => ({
    meta: [
      { title: "Invitations | ERA Systems staff" },
      {
        name: "description",
        content:
          "Platform staff issue and withdraw single-use registration invitations for approved prospects.",
      },
      { property: "og:title", content: "Invitations | ERA Systems staff" },
      {
        property: "og:description",
        content: "Single-use, time-limited registration invites issued after a discovery call.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: InvitesAdmin,
  errorComponent: ({ error }) => (
    <AppShell title="Invitations" variant="staff">
      <div className="era-card p-6">
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : String(error)}</p>
      </div>
    </AppShell>
  ),
});

function InvitesAdmin() {
  const fetchInvites = useServerFn(listInvites);
  const issue = useServerFn(createInvite);
  const revoke = useServerFn(revokeInvite);
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [notes, setNotes] = useState("");
  const [planTier, setPlanTier] = useState<PlanTier>("basic");
  const [subscriptionPrice, setSubscriptionPrice] = useState(String(PLAN_PRICING.basic.monthlyCents / 100));
  const [setupFee, setSetupFee] = useState(String(PLAN_PRICING.basic.setupFeeCents / 100));
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [issuedLink, setIssuedLink] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Anonymous visitors carry no bearer token; the staff-only fn would 401 and
  // blank the page, so only query once a session exists.
  const { data: hasSession } = useQuery({
    queryKey: ["has-session"],
    queryFn: async () => Boolean((await supabase.auth.getSession()).data.session),
    retry: false,
  });

  const invitesQuery = useQuery({
    queryKey: ["invites"],
    queryFn: () => fetchInvites(),
    enabled: hasSession === true,
    retry: false,
  });

  const toCents = (value: string) => Math.round(Number(value || 0) * 100);

  const issueMutation = useMutation({
    mutationFn: () =>
      issue({
        data: {
          email,
          fullName,
          notes: notes || undefined,
          terms: {
            planTier,
            subscriptionPriceCents: toCents(subscriptionPrice),
            setupFeeCents: toCents(setupFee),
            billingInterval,
          },
        },
      }),
    onSuccess: (result) => {
      const origin = typeof window === "undefined" ? "" : window.location.origin;
      setIssuedLink(inviteUrl(origin, result.token));
      setEmailStatus(
        result.emailed
          ? { ok: true, message: `A welcome email with this link was sent to ${result.invite.email}.` }
          : {
              ok: false,
              message: `The welcome email did not send${result.emailError ? `: ${result.emailError}` : ""}. Send the link above manually.`,
            },
      );
      setEmail("");
      setFullName("");
      setNotes("");
      setSubscriptionPrice(String(PLAN_PRICING[planTier].monthlyCents / 100));
      setSetupFee(String(PLAN_PRICING[planTier].setupFeeCents / 100));
      void queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invites"] }),
  });

  return (
    <AppShell title="Invitations" variant="staff" role="Platform staff">
      <p className="text-sm text-muted-foreground">
        Each invite is single-use, tied to one email address, and expires after {INVITE_TTL_DAYS}{" "}
        days. The link is shown once, copy it now, it cannot be retrieved later.
      </p>


      <form
        className="era-card mt-6 grid gap-4 p-6 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setIssuedLink(null);
          issueMutation.mutate();
        }}
      >
        <div>
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="fullName">
            Prospect name
          </label>
          <input
            id="fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="inviteEmail">
            Email
          </label>
          <input
            id="inviteEmail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="notes">
            Discovery-call notes (internal)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div className="sm:col-span-2 border-t border-border pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Commercial terms (staff-set, from the discovery call)
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="planTier">
            Plan tier
          </label>
          <select
            id="planTier"
            value={planTier}
            onChange={(event) => {
              const tier = event.target.value as PlanTier;
              setPlanTier(tier);
              setSubscriptionPrice(String(PLAN_PRICING[tier].monthlyCents / 100));
              setSetupFee(String(PLAN_PRICING[tier].setupFeeCents / 100));
            }}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <option value="basic">Basic</option>
            <option value="growth">Growth</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="interval">
            Billing interval
          </label>
          <select
            id="interval"
            value={billingInterval}
            onChange={(event) => setBillingInterval(event.target.value as BillingInterval)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            {BILLING_INTERVALS.map((interval) => (
              <option key={interval} value={interval}>
                {interval.replace("_", "-")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="subPrice">
            Recurring payment (USD, per billing interval)
          </label>
          <input
            id="subPrice"
            type="number"
            min="0.01"
            required
            step="0.01"
            value={subscriptionPrice}
            onChange={(event) => setSubscriptionPrice(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="setupFee">
            One-time setup fee (USD)
          </label>
          <input
            id="setupFee"
            type="number"
            required
            min="0"
            step="0.01"
            value={setupFee}
            onChange={(event) => setSetupFee(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={issueMutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {issueMutation.isPending ? "Generating…" : "Generate invite link"}
          </button>
        </div>
      </form>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      {issuedLink ? (
        <div className="mt-6 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Copy this link now (shown once)
          </p>
          <code className="mt-2 block break-all text-sm text-foreground">{issuedLink}</code>
          {emailStatus ? (
            <p
              className={`mt-3 text-sm ${emailStatus.ok ? "text-muted-foreground" : "text-destructive"}`}
            >
              {emailStatus.message}
            </p>
          ) : null}
        </div>
      ) : null}

      <h2 className="mt-12 text-lg font-semibold text-foreground">Issued invitations</h2>
      {hasSession === true && invitesQuery.isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : hasSession === false || invitesQuery.error ? (
        <p className="mt-3 text-sm text-destructive">
          Only platform staff can view invitations. Sign in with a staff account.
        </p>
      ) : (
        <ul className="era-card mt-4 divide-y divide-border">
          {(invitesQuery.data ?? []).map((invite: InviteSummary) => (
            <li key={invite.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-medium text-foreground">{invite.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {invite.email} · {inviteStatusLabel(invite)} · expires{" "}
                  {new Date(invite.expiresAt).toLocaleDateString()}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {invite.terms.planTier} · {formatMoney(invite.terms.subscriptionPriceCents)}{" "}
                  {invite.terms.billingInterval}
                  {invite.terms.setupFeeCents > 0
                    ? ` · setup ${formatMoney(invite.terms.setupFeeCents)}`
                    : ""}
                </p>
              </div>
              {invite.status === "pending" ? (
                <button
                  type="button"
                  onClick={() => revokeMutation.mutate(invite.id)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground"
                >
                  Revoke
                </button>
              ) : null}
            </li>
          ))}
          {(invitesQuery.data ?? []).length === 0 ? (
            <li className="px-5 py-4 text-sm text-muted-foreground">No invitations yet.</li>
          ) : null}
        </ul>
      )}
    </AppShell>
  );
}
