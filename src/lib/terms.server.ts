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
import { PLAN_PRICING } from "./pricing";

/**
 * True when staff fixed the commercial terms on the originating invite. When they
 * did, the client cannot pick their own tier; when they didn't, list pricing applies.
 */
export async function hasAgreedInviteTerms(originInviteId: string | null): Promise<boolean> {
  if (!originInviteId) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("invites")
    .select("subscription_price_cents, setup_fee_cents")
    .eq("id", originInviteId)
    .maybeSingle();
  return Boolean(data && (data.subscription_price_cents > 0 || data.setup_fee_cents > 0));
}

export async function resolveAgreedTerms(
  businessId: string,
  planTier: PlanTier,
  originInviteId: string | null,
): Promise<AgreedTerms> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // List pricing is the default; staff-agreed invite pricing overrides it.
  const list = PLAN_PRICING[planTier];
  let subscriptionPriceCents = list.monthlyCents;
  let setupFeeCents = list.setupFeeCents;
  let billingInterval = "monthly";

  if (originInviteId) {
    const { data: invite } = await supabaseAdmin
      .from("invites")
      .select("subscription_price_cents, setup_fee_cents, billing_interval")
      .eq("id", originInviteId)
      .maybeSingle();
    if (invite && (invite.subscription_price_cents > 0 || invite.setup_fee_cents > 0)) {
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
