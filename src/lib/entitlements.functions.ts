import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BusinessAddon, PlatformFeature, TenantEntitlements } from "./entitlements";
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

/**
 * Add-on rows for a business, including the per-client amount.
 * RLS scopes this to members of that business (and platform staff) — the same
 * business_id-keyed predicates used everywhere else. No admin client involved.
 */
export const getBusinessAddons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessIdInput.parse(input))
  .handler(async ({ data, context }): Promise<BusinessAddon[]> => {
    const { data: rows, error } = await context.supabase
      .from("business_addons")
      .select("id, addon, is_active, price_cents, currency, billing_interval, notes")
      .eq("business_id", data.businessId)
      .order("addon", { ascending: true });
    if (error) throw new Error(error.message);

    return (rows ?? []).map((row) => ({
      id: row.id,
      addon: row.addon,
      isActive: row.is_active,
      priceCents: row.price_cents,
      currency: row.currency,
      billingInterval: row.billing_interval,
      notes: row.notes,
    }));
  });

const saveAddonInput = z.object({
  businessId: z.string().uuid(),
  addon: z.enum(["ad_management", "white_label_branding"]),
  priceCents: z.number().int().min(0),
  billingInterval: z.enum(["monthly", "quarterly", "annual", "one_time"]),
  isActive: z.boolean(),
  notes: z.string().max(500).nullable().optional(),
});

/**
 * Staff-entered add-on state and amount. Authorization is the RLS policy
 * `is_platform_staff()` on business_addons — a business owner writing here gets
 * a policy violation, not a silent success.
 */
export const saveBusinessAddon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveAddonInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("business_addons").upsert(
      {
        business_id: data.businessId,
        addon: data.addon,
        price_cents: data.priceCents,
        billing_interval: data.billingInterval,
        is_active: data.isActive,
        deactivated_at: data.isActive ? null : new Date().toISOString(),
        notes: data.notes ?? null,
      },
      { onConflict: "business_id,addon" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
