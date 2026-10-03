import { createFileRoute } from "@tanstack/react-router";

/**
 * Checks whether this browser is a remembered device for the signed-in user.
 * If not, emails a 6-digit code. The caller proves identity with its bearer token.
 */
export const Route = createFileRoute("/api/public/device/start")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const t = await import("@/lib/device-trust.server");
        const user = await t.userFromRequest(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

        if (t.deviceTrustedFor(t.readCookie(request, t.DEVICE_COOKIE), user.id)) {
          return Response.json({ trusted: true });
        }

        const body = (await request.json().catch(() => ({}))) as { resend?: boolean };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: existing } = await supabaseAdmin
          .from("login_codes")
          .select("sent_at, expires_at")
          .eq("user_id", user.id)
          .maybeSingle();
        const fresh =
          existing &&
          new Date(existing.expires_at) > new Date() &&
          Date.now() - new Date(existing.sent_at).getTime() < 60_000;
        if (fresh && !body.resend) return Response.json({ trusted: false, email: user.email });
        if (fresh && body.resend) {
          return Response.json({ trusted: false, email: user.email, wait: true });
        }

        const code = t.newCode();
        const { error } = await supabaseAdmin.from("login_codes").upsert({
          user_id: user.id,
          code_hash: t.hashCode(user.id, code),
          expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
          attempts: 0,
          sent_at: new Date().toISOString(),
        });
        if (error) return Response.json({ error: "could not create code" }, { status: 500 });

        try {
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          await sendTemplateEmail("login-code", user.email, {
            templateData: { code },
            fromLocalPart: "support",
            replyTo: "support@eraleadgen.com",
          });
        } catch (e) {
          console.error("login code email failed", e instanceof Error ? e.message : e);
          return Response.json({ error: "Could not send the code. Try again shortly." }, { status: 502 });
        }
        return Response.json({ trusted: false, email: user.email });
      },
    },
  },
});
