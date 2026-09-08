import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/** Remind a customer roughly a day before the appointment. */
const LEAD_HOURS = 26;
/** Never reminder-spam a booking made at the last minute. */
const MIN_NOTICE_HOURS = 2;

/**
 * Sends the ~24h appointment reminder for every live business.
 *
 * Elevated access: registered in docs/elevated-access.md. The caller is a scheduled
 * job authenticated by the cron secret — there is no user session — and each send is
 * scoped to one booking id and that booking's own business_id. Recipients come from
 * the booking row only; nothing is caller-supplied.
 */
export const Route = createFileRoute("/api/public/cron/booking-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendBookingEmail } = await import("@/lib/customer-emails.server");

        const { data: runRow } = await supabaseAdmin
          .from("scheduled_job_runs")
          .insert({ job_name: "booking-reminders" })
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
        const from = new Date(now + MIN_NOTICE_HOURS * 3600_000).toISOString();
        const to = new Date(now + LEAD_HOURS * 3600_000).toISOString();

        const { data: due, error } = await supabaseAdmin
          .from("bookings")
          .select("id")
          .is("reminder_sent_at", null)
          .not("customer_email", "is", null)
          .in("status", ["pending", "confirmed"])
          .gte("starts_at", from)
          .lte("starts_at", to)
          .limit(500);
        if (error) {
          await finishRun(false, { error: error.message });
          return Response.json({ error: error.message }, { status: 500 });
        }

        let sent = 0;
        let skipped = 0;
        for (const row of due ?? []) {
          const result = await sendBookingEmail(supabaseAdmin, "reminder", row.id);
          if (result.sent) sent += 1;
          else skipped += 1;
        }

        await finishRun(true, { sent, skipped, considered: due?.length ?? 0 });
        return Response.json({ sent, skipped, considered: due?.length ?? 0 });
      },
    },
  },
});
