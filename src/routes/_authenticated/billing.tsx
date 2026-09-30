import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { PortalShell } from "@/components/app/portal-page";
import { Switch } from "@/components/ui/switch";
import { formatMoney, type PlanTier } from "@/lib/entitlements";
import { getPortalWorkspace } from "@/lib/portal.functions";
import { PLAN_PRICING } from "@/lib/pricing";
import {
  getPlanStatus,
  schedulePlanChange,
  setMyAiAgent,
  withdrawPlanChange,
  type PlanStatus,
} from "@/lib/plan-changes.functions";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing | ERA App" },
      { name: "description", content: "Your ERA plan, AI agents, and payments." },
      { property: "og:title", content: "Billing | ERA App" },
      { property: "og:description", content: "Your ERA plan, AI agents, and payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BillingPage,
});

const TIERS: PlanTier[] = ["basic", "growth", "enterprise"];
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

function BillingPage() {
  return (
    <PortalShell title="Billing" feature="payments">
      {(businessId) => (
        <div className="space-y-6">
          <PlanPanel businessId={businessId} />
          <PaymentsList />
        </div>
      )}
    </PortalShell>
  );
}

function PlanPanel({ businessId }: { businessId: string }) {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getPlanStatus);
  const schedule = useServerFn(schedulePlanChange);
  const withdraw = useServerFn(withdrawPlanChange);
  const setAgent = useServerFn(setMyAiAgent);
  const [choice, setChoice] = useState<PlanTier | "">("");
  const [error, setError] = useState<string | null>(null);

  const key = ["plan-status", businessId];
  const status = useQuery({ queryKey: key, queryFn: () => fetchStatus({ data: { businessId } }) });
  const onDone = (next: PlanStatus) => {
    setError(null);
    setChoice("");
    qc.setQueryData(key, next);
  };
  const onErr = (e: unknown) => setError(e instanceof Error ? e.message : "Something went wrong.");

  const change = useMutation({
    mutationFn: (v: { kind: "change" | "cancel"; toTier: PlanTier | null }) =>
      schedule({ data: { businessId, ...v } }),
    onSuccess: onDone,
    onError: onErr,
  });
  const undo = useMutation({ mutationFn: () => withdraw({ data: { businessId } }), onSuccess: onDone, onError: onErr });
  const agent = useMutation({
    mutationFn: (v: { track: "ai_sms" | "ai_voice"; enabled: boolean }) => setAgent({ data: { businessId, ...v } }),
    onSuccess: onDone,
    onError: onErr,
  });

  if (status.isPending) return <div className="era-card p-6 text-sm text-muted-foreground">Loading your plan…</div>;
  if (!status.data) return null;
  const s = status.data;
  const busy = change.isPending || undo.isPending;

  return (
    <>
      <section className="era-card p-6 sm:p-7">
        <h2 className="text-base font-semibold tracking-tight text-foreground">Your plan</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {PLAN_PRICING[s.tier].name} · {formatMoney(PLAN_PRICING[s.tier].monthlyCents)}/month list price
          {s.periodEnd ? ` · current period ends ${fmtDate(s.periodEnd)}` : ""}
        </p>

        {s.scheduled ? (
          <div className="mt-5 rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-sm text-foreground">
              {s.scheduled.kind === "cancel"
                ? `Your subscription is cancelled. You keep full access until ${fmtDate(s.scheduled.effectiveAt)}.`
                : `Your plan changes to ${PLAN_PRICING[s.scheduled.toTier!].name} on ${fmtDate(s.scheduled.effectiveAt)}.`}
            </p>
            <button
              type="button"
              className="mt-3 text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
              disabled={busy}
              onClick={() => undo.mutate()}
            >
              {s.scheduled.kind === "cancel" ? "Keep my subscription" : "Keep my current plan"}
            </button>
          </div>
        ) : s.lifecycle !== "active" ? (
          <p className="mt-5 text-sm text-muted-foreground">Plan changes are available once your account is active.</p>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1 text-sm">
                <span className="mb-1 block text-muted-foreground">Upgrade or downgrade</span>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
                  value={choice}
                  onChange={(e) => setChoice(e.target.value as PlanTier)}
                >
                  <option value="">Choose a plan…</option>
                  {TIERS.filter((t) => t !== s.tier).map((t) => (
                    <option key={t} value={t}>
                      {PLAN_PRICING[t].name} · {formatMoney(PLAN_PRICING[t].monthlyCents)}/month
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                disabled={!choice || busy}
                onClick={() => choice && change.mutate({ kind: "change", toTier: choice })}
              >
                Schedule change
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Changes take effect when your current billing period ends
              {s.periodEnd ? ` (${fmtDate(s.periodEnd)})` : ""}. Your ERA team will confirm the new price.
            </p>
            <button
              type="button"
              className="text-sm text-destructive underline-offset-4 hover:underline disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Cancel your subscription? You keep access until the end of your current billing period. There are no refunds for the current period."))
                  change.mutate({ kind: "cancel", toTier: null });
              }}
            >
              Cancel subscription
            </button>
          </div>
        )}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </section>

      {s.aiAgentsAvailable ? (
        <section className="era-card p-6 sm:p-7">
          <h2 className="text-base font-semibold tracking-tight text-foreground">AI agents</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose which AI agents you want to use. Your ERA team is notified of every change.
          </p>
          <div className="mt-5 divide-y divide-border/60">
            {(
              [
                ["ai_sms", "AI SMS agent", "Answers and books customers by text message."],
                ["ai_voice", "AI voice agent", "Answers phone calls for your business."],
              ] as const
            ).map(([track, label, hint]) => (
              <div key={track} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
                <Switch
                  checked={s.aiTracks[track]}
                  disabled={agent.isPending}
                  onCheckedChange={(enabled) => agent.mutate({ track, enabled })}
                  aria-label={label}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function PaymentsList() {
  const fetchWorkspace = useServerFn(getPortalWorkspace);
  const ws = useQuery({ queryKey: ["portal-workspace"], queryFn: () => fetchWorkspace() });
  const payments = ws.data?.payments ?? [];
  return (
    <section className="era-card overflow-hidden">
      <h2 className="px-5 pt-5 text-base font-semibold tracking-tight text-foreground">Payments</h2>
      {payments.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">No payments recorded yet.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {payments.map((p) => (
            <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 p-5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{formatMoney(p.amountCents)}</p>
                <p className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</p>
              </div>
              <span className="era-chip shrink-0">{p.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
