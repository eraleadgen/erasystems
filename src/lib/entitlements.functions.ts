import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PlatformFeature, TenantEntitlements } from "./entitlements";
import { ALL_FEATURES } from "./entitlements";

const businessIdInput = z.object({ businessId: z.string().uuid() });

/**
 * Public route gating only. Returns a single boolean — never the tier, never the
 * feature list. A visitor can learn that /portal exists for this tenant (which the
 * HTTP status already tells them); they learn nothing else about the plan.
 */
export const checkTenantFeature = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    businessIdInput
      .extend({ feature: z.enum(ALL_FEATURES as [PlatformFeature, ...PlatformFeature[]]) })
      .parse(input),
  )
  .handler(async ({ data }): Promise<boolean> => {
    const { fetchTierEntitlements } = await import("./entitlements.server");
    const entitlements = await fetchTierEntitlements(data.businessId);
    return Boolean(entitlements?.features.includes(data.feature));
  });

/**
 * The tenant's own tier + feature matrix. Authenticated and membership-scoped:
 * only a member of that business (or platform staff) can read it. Customers of
 * the business — and anonymous visitors — get null.
 */
export const getMyEntitlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessIdInput.parse(input))
  .handler(async ({ data, context }): Promise<TenantEntitlements | null> => {
    const { data: membership } = await context.supabase
      .from("business_members")
      .select("id")
      .eq("business_id", data.businessId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!membership) {
      const { data: isStaff } = await context.supabase.rpc("is_platform_staff");
      if (!isStaff) return null;
    }

    const { fetchTierEntitlements } = await import("./entitlements.server");
    return fetchTierEntitlements(data.businessId);
  });

