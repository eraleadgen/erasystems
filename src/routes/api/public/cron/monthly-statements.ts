import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Sends last month's statement to every active business that opted in.
 *
 * Elevated access: registered in docs/elevated-access.md. The caller is a scheduled
 * job authenticated by the cron secret — there is no user session — and every read
 * is scoped by an explicit business id. Nothing is written to tenant data.
 */
export const Route = createFileRoute("/api/public/cron/monthly-statements")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendStatementEmail } = await import("@/lib/statements.server");

        const { data: runRow } = await supabaseAdmin
          .from("scheduled_job_runs")
          .insert({ job_name: "monthly-statements" })
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

        const { data: optedIn, error } = await supabaseAdmin
          .from("business_site")
          .select("business_id")
          .eq("statement_email_enabled", true);
        if (error) {
          await finishRun(false, { error: error.message });
          return Response.json({ error: error.message }, { status: 500 });
        }

        let sent = 0;
        let skipped = 0;
        for (const row of optedIn ?? []) {
          const { data: business } = await supabaseAdmin
            .from("businesses")
            .select("id, is_active, plan_tier")
            .eq("id", row.business_id)
            .maybeSingle();
          if (!business?.is_active || business.plan_tier !== "enterprise") {
            skipped += 1;
            continue;
          }
          try {
            const result = await sendStatementEmail(supabaseAdmin, row.business_id, {
              requireEnabled: true,
            });
            if (result.sent) sent += 1;
            else skipped += 1;
          } catch {
            skipped += 1;
          }
        }

        await finishRun(true, { sent, skipped });
        return Response.json({ sent, skipped });
      },
    },
  },
});
