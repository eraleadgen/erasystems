/**
 * Welcome email to the business owner the moment their payment activates the account.
 *
 * Elevated access: registered in docs/elevated-access.md. It runs on the payment
 * webhook path where there is no end-user session, and every read is a single
 * business_id-scoped read of the business the verified payment row identifies.
 * A failed email never fails a payment.
 */

import { PLAN_PRICING } from "./pricing";

const APP_BASE_URL = "https://www.eraleadgen.com";

export async function sendOwnerWelcome(businessId: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id, name, plan_tier, support_email, welcome_email_sent_at")
      .eq("id", businessId)
      .maybeSingle();
    if (!business || business.welcome_email_sent_at) return;

    const { data: owner } = await supabaseAdmin
      .from("business_members")
      .select("user_id")
      .eq("business_id", businessId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    let ownerEmail = business.support_email ?? "";
    let ownerName = "";
    if (owner?.user_id) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(owner.user_id);
      ownerEmail = authUser?.user?.email ?? ownerEmail;
      ownerName = String(authUser?.user?.user_metadata?.["full_name"] ?? "");
    }
    if (!ownerEmail) return;

    // Claim before sending so a webhook retry can't double-send.
    const { data: claimed } = await supabaseAdmin
      .from("businesses")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", businessId)
      .is("welcome_email_sent_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) return;

    const { sendTemplateEmail } = await import("./email-templates/send-email");
    await sendTemplateEmail("owner-welcome", ownerEmail, {
      idempotencyKey: `owner-welcome-${businessId}`,
      replyTo: "support@eraleadgen.com",
      templateData: {
        businessName: business.name,
        ownerName: ownerName ? (ownerName.split(" ")[0] ?? ownerName) : "there",
        planTier: PLAN_PRICING[business.plan_tier as keyof typeof PLAN_PRICING]?.name ?? "",
        dashboardUrl: `${APP_BASE_URL}/dashboard`,
      },
    });
  } catch (error) {
    console.error("owner welcome email failed", error instanceof Error ? error.message : error);
  }
}
