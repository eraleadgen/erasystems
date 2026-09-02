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
        const cutoff = new Date(
          Date.now() - EXPIRE_AFTER_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString();

        const { data: stale, error } = await supabaseAdmin
          .from("businesses")
          .select("id")
          .eq("lifecycle", "pending_payment")
          .lt("created_at", cutoff);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const expired: string[] = [];
        for (const row of stale ?? []) {
          const { error: updateError } = await supabaseAdmin
            .from("businesses")
            .update({ lifecycle: "expired", slug_reserved_until: null })
            .eq("id", row.id)
            .eq("lifecycle", "pending_payment");
          if (!updateError) expired.push(row.id);
        }

        return Response.json({ expired: expired.length });
      },
    },
  },
});
