import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GENERIC_CHECKOUT_ERROR } from "./payments";
import { APP_ADDON, PLAN_PRICING } from "./pricing";

const selectPlanInput = z.object({
  tier: z.enum(["basic", "growth", "enterprise"]),
  includeApp: z.boolean(),
});

export type PlanSelection = {
  tier: "basic" | "growth" | "enterprise";
  includeApp: boolean;
  locked: boolean;
};

/**
 * The tier and add-on state the client is currently pointed at, plus whether a
 * staff-agreed invite already fixed the commercial terms (in which case the
 * picker is read-only). Membership-scoped through RLS.
 */
export const getMyPlanSelection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlanSelection | null> => {
    const { data: membership } = await context.supabase
      .from("business_members")
      .select("business_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!membership) return null;

    const { data: business } = await context.supabase
      .from("businesses")
      .select("id, plan_tier, origin_invite_id")
      .eq("id", membership.business_id)
      .maybeSingle();
    if (!business) return null;

    const { data: addons } = await context.supabase
      .from("business_addons")
      .select("addon")
      .eq("business_id", business.id)
      .eq("addon", APP_ADDON);

    const { hasAgreedInviteTerms } = await import("./terms.server");
    const locked = await hasAgreedInviteTerms(business.origin_invite_id);

    return {
      tier: business.plan_tier as PlanSelection["tier"],
      includeApp: (addons ?? []).length > 0,
      locked,
    };
  });

/**
 * A client choosing their own tier and whether the downloadable apps are part of
 * the build. Elevated write: `plan_tier` and `business_addons` are staff-guarded
 * under RLS, so the change is applied with the service-role client *after* the
 * caller is authorized through their own membership row (see
 * docs/elevated-access.md). Nothing about price comes from the request: the
 * amounts are read from the server's own PLAN_PRICING table.
 *
 * Add-ons are written inactive; only verified payment activates them.
 */
export const selectMyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => selectPlanInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: membership } = await context.supabase
      .from("business_members")
      .select("business_id, role")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      throw new Error(GENERIC_CHECKOUT_ERROR);
    }

    const { data: business } = await context.supabase
      .from("businesses")
      .select("id, lifecycle, origin_invite_id")
      .eq("id", membership.business_id)
      .maybeSingle();
    if (!business) throw new Error(GENERIC_CHECKOUT_ERROR);

    // The plan is only choosable while the business is still waiting to go live.
    if (business.lifecycle !== "pending_payment" && business.lifecycle !== "expired") {
      throw new Error("Your plan is already active. Your ERA representative can change it.");
    }

    const { hasAgreedInviteTerms } = await import("./terms.server");
    if (await hasAgreedInviteTerms(business.origin_invite_id)) {
      throw new Error("Your plan was already agreed with your ERA representative.");
    }

    const price = PLAN_PRICING[data.tier];
    // Enterprise app builds are scoped on a call before any money is collected.
    const includeApp = data.includeApp && !price.appRequiresCall;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: tierError } = await supabaseAdmin
      .from("businesses")
      .update({ plan_tier: data.tier })
      .eq("id", business.id)
      .in("lifecycle", ["pending_payment", "expired"]);
    if (tierError) throw new Error(tierError.message);

    if (includeApp) {
      const { error } = await supabaseAdmin.from("business_addons").upsert(
        {
          business_id: business.id,
          addon: APP_ADDON,
          price_cents: price.appAddonCents,
          billing_interval: "one_time",
          is_active: false,
          deactivated_at: new Date().toISOString(),
          notes: "Selected by the client at checkout.",
        },
        { onConflict: "business_id,addon" },
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("business_addons")
        .delete()
        .eq("business_id", business.id)
        .eq("addon", APP_ADDON)
        .eq("is_active", false);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });
