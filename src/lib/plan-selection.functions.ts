import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GENERIC_CHECKOUT_ERROR } from "./payments";


const selectPlanInput = z.object({
  tier: z.enum(["basic", "growth", "enterprise"]),
});

export type PlanSelection = {
  tier: "basic" | "growth" | "enterprise";
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

    const { hasAgreedInviteTerms } = await import("./terms.server");
    const locked = await hasAgreedInviteTerms(business.origin_invite_id);

    return {
      tier: business.plan_tier as PlanSelection["tier"],
      locked,
    };

  });

/**
 * A client choosing their own tier. Elevated write: `plan_tier` is staff-guarded
 * under RLS, so the change is applied with the service-role client *after* the
 * caller is authorized through their own membership row (see
 * docs/elevated-access.md). Nothing about price comes from the request: the
 * amounts are read from the server's own PLAN_PRICING table.
 *
 * Add-ons are never bought here — both are quoted per business by staff.
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: tierError } = await supabaseAdmin
      .from("businesses")
      .update({ plan_tier: data.tier })
      .eq("id", business.id)
      .in("lifecycle", ["pending_payment", "expired"]);
    if (tierError) throw new Error(tierError.message);


    return { ok: true };
  });
