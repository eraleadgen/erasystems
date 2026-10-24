/**
 * Owner-facing billing emails (payment failed, service paused).
 *
 * Elevated access: registered in docs/elevated-access.md. Runs on the verified
 * Stripe webhook and the scheduled expire-businesses job, where there is no user
 * session; every read is scoped to the one business_id passed in by that caller.
 * Never throws: a failed email must never fail the webhook or the job.
 */

const APP_BASE_URL = "https://www.eraleadgen.com";

export async function sendBillingNotice(args: {
  businessId: string;
  kind: "payment_failed" | "suspended";
  idempotencyKey: string;
  graceEndsAt?: string | null;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id, name, support_email")
      .eq("id", args.businessId)
      .maybeSingle();
    if (!business) return;

    const { data: owner } = await supabaseAdmin
      .from("business_members")
      .select("user_id")
      .eq("business_id", args.businessId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();
    let to = business.support_email ?? "";
    if (owner?.user_id) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(owner.user_id);
      to = u?.user?.email ?? to;
    }
    if (!to) return;

    const { data: billing } = await supabaseAdmin
      .from("business_billing")
      .select("stripe_customer_id")
      .eq("business_id", args.businessId)
      .maybeSingle();
    let manageUrl = `${APP_BASE_URL}/billing`;
    if (billing?.stripe_customer_id) {
      try {
        const { createBillingPortalSession } = await import("./payments.server");
        manageUrl = await createBillingPortalSession(billing.stripe_customer_id, `${APP_BASE_URL}/billing`);
      } catch (error) {
        console.error("billing portal link failed", error instanceof Error ? error.message : error);
      }
    }

    const { sendTemplateEmail } = await import("./email-templates/send-email");
    await sendTemplateEmail("billing-notice", to, {
      idempotencyKey: args.idempotencyKey,
      replyTo: "support@eraleadgen.com",
      templateData: {
        businessName: business.name,
        kind: args.kind,
        manageUrl,
        graceEnds: args.graceEndsAt
          ? new Date(args.graceEndsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
          : "",
      },
    });
  } catch (error) {
    console.error("billing notice failed", error instanceof Error ? error.message : error);
  }
}
