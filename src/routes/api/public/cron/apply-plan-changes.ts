import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Applies scheduled plan changes and cancellations whose billing period has ended.
 * Elevated access (registered in docs/elevated-access.md): scheduled job
 * authenticated by the cron secret; every write is scoped by an explicit business id
 * taken from the plan_change_requests row.
 */
export const Route = createFileRoute("/api/public/cron/apply-plan-changes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendStaffAlert } = await import("@/lib/staff-alerts.server");
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
        for (const row of due ?? []) {
          const update =
            row.kind === "cancel"
              ? { lifecycle: "suspended" as const, is_active: false }
              : { plan_tier: row.to_tier! };
          const { data: biz, error: updErr } = await supabaseAdmin
            .from("businesses")
            .update(update)
            .eq("id", row.business_id)
            .select("name")
            .maybeSingle();
          if (updErr) continue;
          await supabaseAdmin
            .from("plan_change_requests")
            .update({ status: "applied", applied_at: new Date().toISOString() })
            .eq("id", row.id)
            .eq("business_id", row.business_id);
          applied += 1;
          await sendStaffAlert({
            title: row.kind === "cancel" ? "Cancellation took effect" : "Plan change took effect",
            businessId: row.business_id,
            businessName: biz?.name ?? "A client",
            summary:
              row.kind === "cancel"
                ? "The client's paid period ended. Their account is now offline."
                : `The client is now on the ${row.to_tier} plan.`,
            idempotencyKey: `plan-change-applied-${row.id}`,
          });
        }

        if (runRow?.id) {
          await supabaseAdmin
            .from("scheduled_job_runs")
            .update({ finished_at: new Date().toISOString(), succeeded: true, detail: { applied } as never })
            .eq("id", runRow.id);
        }
        return Response.json({ applied });
      },
    },
  },
});
