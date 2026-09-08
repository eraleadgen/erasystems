import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Wait until the job is comfortably finished before asking. */
const MIN_HOURS_AFTER = 4;
/** Don't chase stale work if a booking is only marked complete much later. */
const MAX_DAYS_AFTER = 14;

/**
 * Asks customers of completed jobs for a review.
 *
 * Elevated access: registered in docs/elevated-access.md. The caller is a scheduled
 * job authenticated by the cron secret — there is no user session — and each send is
 * scoped to one booking id and that booking's own business_id.
 */
export const Route = createFileRoute("/api/public/cron/review-requests")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendBookingEmail } = await import("@/lib/customer-emails.server");

        const { data: runRow } = await supabaseAdmin
          .from("scheduled_job_runs")
          .insert({ job_name: "review-requests" })
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

        const now = Date.now();
        const before = new Date(now - MIN_HOURS_AFTER * 3600_000).toISOString();
        const after = new Date(now - MAX_DAYS_AFTER * 24 * 3600_000).toISOString();

        const { data: due, error } = await supabaseAdmin
          .from("bookings")
          .select("id")
          .is("review_request_sent_at", null)
          .not("customer_email", "is", null)
          .eq("status", "completed")
          .gte("starts_at", after)
          .lte("starts_at", before)
          .limit(500);
        if (error) {
          await finishRun(false, { error: error.message });
          return Response.json({ error: error.message }, { status: 500 });
        }

        let sent = 0;
        let skipped = 0;
        for (const row of due ?? []) {
          const result = await sendBookingEmail(supabaseAdmin, "review", row.id);
          if (result.sent) sent += 1;
          else skipped += 1;
        }

        await finishRun(true, { sent, skipped, considered: due?.length ?? 0 });
        return Response.json({ sent, skipped, considered: due?.length ?? 0 });
      },
    },
  },
});
