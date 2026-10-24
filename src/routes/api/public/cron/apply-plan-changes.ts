import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Applies scheduled plan changes and cancellations whose billing period has ended.
 * Elevated access (registered in docs/elevated-access.md): scheduled job
 * authenticated by the cron secret; every read/write is scoped by an explicit business
 * id taken from the plan_change_requests row.
 *
 * Stripe goes first. If Stripe refuses, the request stays scheduled (next run retries),
 * the tier/lifecycle is untouched, the error lands in this run's detail, and staff are
 * alerted once per request.
 */
export const Route = createFileRoute("/api/public/cron/apply-plan-changes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendStaffAlert } = await import("@/lib/staff-alerts.server");
        const { updateStripeSubscriptionPrice, cancelStripeSubscription } = await import(
          "@/lib/payments.server"
        );
        const { PLAN_PRICING } = await import("@/lib/pricing");
        const intervalMonths = (i: string) => (i === "monthly" ? 1 : i === "quarterly" ? 3 : i === "annual" ? 12 : null);

        const { data: runRow } = await supabaseAdmin
          .from("scheduled_job_runs")
          .insert({ job_name: "apply-plan-changes" })
          .select("id")
          .maybeSingle();

        const { data: due, error } = await supabaseAdmin
          .from("plan_change_requests")
          .select("id, business_id, kind, to_tier")
          .eq("status", "scheduled")
          .lte("effective_at", new Date().toISOString());
        if (error) return Response.json({ error: error.message }, { status: 500 });

        let applied = 0;
        const failures: { requestId: string; businessId: string; error: string }[] = [];

        for (const row of due ?? []) {
          const { data: biz } = await supabaseAdmin
            .from("businesses")
            .select("name, origin_invite_id")
            .eq("id", row.business_id)
            .maybeSingle();
          const name = biz?.name ?? "A client";

          // 1. Stripe.
          try {
            const { data: billing } = await supabaseAdmin
              .from("business_billing")
              .select("stripe_subscription_id")
              .eq("business_id", row.business_id)
              .maybeSingle();
            const subId = billing?.stripe_subscription_id ?? null;
            if (subId) {
              if (row.kind === "cancel") {
                await cancelStripeSubscription(subId);
              } else {
                let interval = "monthly";
                let invite: { plan_tier: string; subscription_price_cents: number; billing_interval: string } | null = null;
                if (biz?.origin_invite_id) {
                  const { data } = await supabaseAdmin
                    .from("invites")
                    .select("plan_tier, subscription_price_cents, billing_interval")
                    .eq("id", biz.origin_invite_id)
                    .maybeSingle();
                  invite = data;
                  if (data?.billing_interval) interval = data.billing_interval;
                }
                const months = intervalMonths(interval);
                if (!months) throw new Error(`Billing interval "${interval}" has no recurring Stripe price.`);
                // Staff-agreed price for the new tier wins; otherwise list price per period.
                const amountCents =
                  invite && invite.plan_tier === row.to_tier && invite.subscription_price_cents > 0
                    ? invite.subscription_price_cents
                    : PLAN_PRICING[row.to_tier!].monthlyCents * months;
                await updateStripeSubscriptionPrice({ subscriptionId: subId, amountCents, interval });
              }
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`apply-plan-changes stripe failed request=${row.id}`, message);
            failures.push({ requestId: row.id, businessId: row.business_id, error: message });
            await sendStaffAlert({
              title: row.kind === "cancel" ? "Stripe cancellation failed" : "Stripe plan change failed",
              businessId: row.business_id,
              businessName: name,
              summary:
                "A scheduled change is due but Stripe refused the update. Nothing was changed in ERA; the job will retry daily. Check the subscription in Stripe.",
              details: [{ label: "Error", value: message.slice(0, 300) }],
              idempotencyKey: `plan-change-stripe-failed-${row.id}`,
            });
            continue;
          }

          // 2. ERA.
          const update =
            row.kind === "cancel"
              ? { lifecycle: "suspended" as const, is_active: false }
              : { plan_tier: row.to_tier! };
          const { error: updErr } = await supabaseAdmin
            .from("businesses")
            .update(update)
            .eq("id", row.business_id);
          if (updErr) {
            failures.push({ requestId: row.id, businessId: row.business_id, error: updErr.message });
            continue;
          }
          await supabaseAdmin
            .from("plan_change_requests")
            .update({ status: "applied", applied_at: new Date().toISOString() })
            .eq("id", row.id)
            .eq("business_id", row.business_id);
          applied += 1;
          await sendStaffAlert({
            title: row.kind === "cancel" ? "Cancellation took effect" : "Plan change took effect",
            businessId: row.business_id,
            businessName: name,
            summary:
              row.kind === "cancel"
                ? "The client's paid period ended. Their account is now offline."
                : `The client is now on the ${row.to_tier} plan.`,
            idempotencyKey: `plan-change-applied-${row.id}`,
          });
        }

        const succeeded = failures.length === 0;
        if (runRow?.id) {
          await supabaseAdmin
            .from("scheduled_job_runs")
            .update({
              finished_at: new Date().toISOString(),
              succeeded,
              detail: { applied, failed: failures.length, failures } as never,
            })
            .eq("id", runRow.id);
        }
        return Response.json({ applied, failed: failures.length }, { status: 200 });
      },
    },
  },
});
