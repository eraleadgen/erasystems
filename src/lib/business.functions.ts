import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BusinessLifecycle = "pending_payment" | "active" | "suspended" | "expired";

export type MyBusiness = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  planTier: string;
  isActive: boolean;
  lifecycle: BusinessLifecycle;
  slugReservedUntil: string | null;
  serviceCount: number;
  role: string;
};

/**
 * The caller's own business, resolved through their membership row. RLS-scoped —
 * no admin client — so a user can only ever see a business they belong to.
 */
export const getMyBusiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyBusiness | null> => {
    const { data: membership } = await context.supabase
      .from("business_members")
      .select("business_id, role")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!membership) return null;

    const { data: business, error } = await context.supabase
      .from("businesses")
      .select("id, name, slug, timezone, plan_tier, is_active, lifecycle, slug_reserved_until")
      .eq("id", membership.business_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!business) return null;

    const { count } = await context.supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id);

    return {
      id: business.id,
      name: business.name,
      slug: business.slug,
      timezone: business.timezone,
      planTier: business.plan_tier,
      isActive: business.is_active,
      lifecycle: business.lifecycle as BusinessLifecycle,
      slugReservedUntil: business.slug_reserved_until,
      serviceCount: count ?? 0,
      role: membership.role,
    };
  });
