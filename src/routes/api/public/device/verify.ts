import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/** Checks the emailed code and, on success, remembers this browser. */
export const Route = createFileRoute("/api/public/device/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const t = await import("@/lib/device-trust.server");
        const user = await t.userFromRequest(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

        const parsed = z
          .object({ code: z.string().regex(/^\d{6}$/), remember: z.boolean() })
          .safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Enter the 6-digit code." }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("login_codes")
          .select("code_hash, expires_at, attempts")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!row || new Date(row.expires_at) < new Date() || row.attempts >= 5) {
          return Response.json({ error: "That code has expired. Send a new one." }, { status: 400 });
        }
        if (row.code_hash !== t.hashCode(user.id, parsed.data.code)) {
          await supabaseAdmin
            .from("login_codes")
            .update({ attempts: row.attempts + 1 })
            .eq("user_id", user.id);
          return Response.json({ error: "That code isn't right." }, { status: 400 });
        }
        await supabaseAdmin.from("login_codes").delete().eq("user_id", user.id);
        return new Response(JSON.stringify({ ok: true }), {
          headers: {
            "content-type": "application/json",
            "set-cookie": t.deviceCookieHeader(user.id, parsed.data.remember),
          },
        });
      },
    },
  },
});
