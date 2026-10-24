import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

const EXPIRE_AFTER_DAYS = 30;

/**
 * Marks never-paid businesses as expired and releases their reserved address.
 * Nothing is deleted: the business row, its owner membership and its catalog stay
 * intact, and the payment path can reactivate an expired business.
 *
 * Elevated access: registered in docs/elevated-access.md. The caller is a scheduled
 * job authenticated by the cron secret — there is no user session — and every write
 * is scoped by an explicit business id.
 */
export const Route = createFileRoute("/api/public/cron/expire-businesses")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: runRow } = await supabaseAdmin
          .from("scheduled_job_runs")
          .insert({ job_name: "expire-businesses" })
          .select("id")
          .maybeSingle();
        const finishRun = async (succeeded: boolean, detail: unknown) => {
          if (!runRow?.id) return;
          await supabaseAdmin
            .from("scheduled_job_runs")
            .update({
              finished_at: new Date().toISOString(),
              succeeded,
              detail: detail as never,
            })
            .eq("id", runRow.id);
        };
        const cutoff = new Date(
          Date.now() - EXPIRE_AFTER_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString();

        const { data: stale, error } = await supabaseAdmin
          .from("businesses")
          .select("id")
          .eq("lifecycle", "pending_payment")
          .lt("created_at", cutoff);
        if (error) {
          await finishRun(false, { error: error.message });
          return Response.json({ error: error.message }, { status: 500 });
        }

        const expired: string[] = [];
        for (const row of stale ?? []) {
          const { error: updateError } = await supabaseAdmin
            .from("businesses")
            .update({ lifecycle: "expired", slug_reserved_until: null })
            .eq("id", row.id)
            .eq("lifecycle", "pending_payment");
          if (!updateError) expired.push(row.id);
        }

        // Billing suspension: grace period over, or cancelled subscription's paid period over.
        const nowIso = new Date().toISOString();
        const { data: due, error: dueError } = await supabaseAdmin
          .from("business_billing")
          .select("business_id, grace_ends_at, suspend_at")
          .or(`grace_ends_at.lt.${nowIso},suspend_at.lt.${nowIso}`);
        if (dueError) {
          await finishRun(false, { expired: expired.length, error: dueError.message });
          return Response.json({ error: dueError.message }, { status: 500 });
        }
        let suspendedGrace = 0;
        let suspendedCancelled = 0;
        const { sendBillingNotice } = await import("@/lib/billing-notices.server");
        for (const row of due ?? []) {
          const { data: changed } = await supabaseAdmin
            .from("businesses")
            .update({ lifecycle: "suspended", is_active: false })
            .eq("id", row.business_id)
            .eq("lifecycle", "active")
            .select("id")
            .maybeSingle();
          if (!changed) continue;
          await supabaseAdmin
            .from("business_billing")
            .update({ billing_suspended: true })
            .eq("business_id", row.business_id);
          const byGrace = Boolean(row.grace_ends_at && row.grace_ends_at < nowIso);
          if (byGrace) suspendedGrace++;
          else suspendedCancelled++;
          await sendBillingNotice({
            businessId: row.business_id,
            kind: "suspended",
            idempotencyKey: `billing-suspended-${row.business_id}-${(byGrace ? row.grace_ends_at : row.suspend_at) ?? nowIso}`,
          });
        }

        const summary = {
          expired: expired.length,
          suspended_grace: suspendedGrace,
          suspended_cancelled: suspendedCancelled,
        };
        await finishRun(true, summary);
        return Response.json(summary);
      },
    },
  },
});
