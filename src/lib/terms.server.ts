/**
 * Server-only resolution of a business's staff-agreed commercial terms.
 *
 * Elevated access: the tier price lives on the originating invite, which is
 * platform-staff-only under RLS, so this reads it with the service-role client.
 * Per docs/elevated-access.md the caller is authorized first (the calling server
 * function resolves the business through the caller's own membership row), the
 * invite id comes from the business row rather than the request, and the read is
 * a single `.eq("id", …)` — no listing, no cross-tenant surface.
 */

import type { AddonKind, PlanTier } from "./entitlements";
import type { AgreedTerms } from "./payments";

export async function resolveAgreedTerms(
  businessId: string,
  planTier: PlanTier,
  originInviteId: string | null,
): Promise<AgreedTerms> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let subscriptionPriceCents = 0;
  let setupFeeCents = 0;
  let billingInterval = "monthly";

  if (originInviteId) {
    const { data: invite } = await supabaseAdmin
      .from("invites")
      .select("subscription_price_cents, setup_fee_cents, billing_interval")
      .eq("id", originInviteId)
      .maybeSingle();
    if (invite) {
      subscriptionPriceCents = invite.subscription_price_cents;
      setupFeeCents = invite.setup_fee_cents;
      billingInterval = invite.billing_interval;
    }
  }

  const { data: addonRows } = await supabaseAdmin
    .from("business_addons")
    .select("addon, price_cents, billing_interval")
    .eq("business_id", businessId);

  const addons = (addonRows ?? []).map((row) => ({
    addon: row.addon as AddonKind,
    priceCents: row.price_cents,
    billingInterval: row.billing_interval,
  }));

  const totalCents =
    subscriptionPriceCents +
    setupFeeCents +
    addons.reduce((sum, row) => sum + row.priceCents, 0);

  return {
    planTier,
    subscriptionPriceCents,
    setupFeeCents,
    billingInterval,
    addons,
    totalCents,
  };
}
