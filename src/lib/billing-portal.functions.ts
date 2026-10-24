import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Whether Stripe test mode is on. Only platform staff ever get `true`. */
export const getStripeMode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ testMode: boolean }> => {
    const { data: isStaff } = await context.supabase.rpc("is_platform_staff");
    if (!isStaff) return { testMode: false };
    const { isStripeTestMode } = await import("./payments.server");
    return { testMode: isStripeTestMode() };
  });

/**
 * Opens a Stripe customer portal for the caller's own business. The business and
 * Stripe customer come from the RLS-scoped client; nothing comes from the request.
 */
export const openMyBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ url: string }> => {
    const { data: membership } = await context.supabase
      .from("business_members")
      .select("business_id")
      .eq("user_id", context.userId)
      .eq("role", "owner")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!membership) throw new Error("Only the business owner can manage billing.");

    const { data: billing } = await context.supabase
      .from("business_billing")
      .select("stripe_customer_id")
      .eq("business_id", membership.business_id)
      .maybeSingle();
    if (!billing?.stripe_customer_id)
      throw new Error("No payment method on file yet. Your ERA team can help set up automatic payments.");

    const { createBillingPortalSession } = await import("./payments.server");
    try {
      return { url: await createBillingPortalSession(billing.stripe_customer_id, "https://www.eraleadgen.com/billing") };
    } catch {
      throw new Error("Couldn't open the payment page right now. Please try again shortly.");
    }
  });
