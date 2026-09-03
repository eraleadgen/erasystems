/**
 * Internal "a client just paid" notification.
 *
 * Elevated read: it runs on the payment path where there is no end-user session
 * (webhook), and it assembles staff-only facts. Every query is a single
 * `business_id`-scoped read of a business the payments row already identified,
 * per docs/elevated-access.md. Failure to send never fails a payment.
 */

import { ADDON_LABELS, formatMoney, type AddonKind } from "./entitlements";
import { PLAN_PRICING } from "./pricing";

const ADMIN_BASE_URL = "https://www.eraleadgen.com";

export async function notifyTierPurchased(businessId: string, amountCents: number): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id, name, legal_name, slug, plan_tier, timezone, support_email, support_phone")
      .eq("id", businessId)
      .maybeSingle();
    if (!business) return;

    const { data: addons } = await supabaseAdmin
      .from("business_addons")
      .select("addon, is_active")
      .eq("business_id", businessId);

    const { count } = await supabaseAdmin
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId);

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

    const activeAddons = (addons ?? [])
      .filter((row) => row.is_active)
      .map((row) => ADDON_LABELS[row.addon as AddonKind]);

    const { sendTemplateEmail } = await import("./email-templates/send-email");
    await sendTemplateEmail("tier-purchased", "support@eraleadgen.com", {
      idempotencyKey: `tier-purchased-${businessId}`,
      ...(ownerEmail ? { replyTo: ownerEmail } : {}),
      templateData: {
        businessName: business.name,
        legalName: business.legal_name ?? "",
        slug: business.slug,
        planTier: PLAN_PRICING[business.plan_tier as keyof typeof PLAN_PRICING].name,
        amount: formatMoney(amountCents),
        addons: activeAddons.length ? activeAddons.join(", ") : "None",
        ownerEmail,
        ownerName,
        supportPhone: business.support_phone ?? "",
        timezone: business.timezone,
        serviceCount: String(count ?? 0),
        paidAt: new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
        profileUrl: `${ADMIN_BASE_URL}/admin/clients/${business.id}`,
      },
    });
  } catch (error) {
    console.error(
      "tier purchase notification failed",
      error instanceof Error ? error.message : error,
    );
  }
}
