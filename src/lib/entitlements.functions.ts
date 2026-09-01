import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { BusinessAddon, PlatformFeature, TenantEntitlements } from "./entitlements";

/** Publishable-key client for anon-readable data. Never the service role. */
function publicClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

const businessIdInput = z.object({ businessId: z.string().uuid() });

/**
 * Tier entitlements for a tenant. Public: the tier->feature map is static
 * price-list data. Add-on rows (and their per-client amounts) are NOT included
 * here and are not readable by anon at all.
 */
export const getTenantEntitlements = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => businessIdInput.parse(input))
  .handler(async ({ data }): Promise<TenantEntitlements | null> => {
    const supabase = publicClient();
    if (!supabase) return null;

    const { data: business } = await supabase
      .from("businesses")
      .select("plan_tier")
      .eq("id", data.businessId)
      .eq("is_active", true)
      .maybeSingle();
    if (!business) return null;

    const { data: rows } = await supabase
      .from("plan_tier_features")
      .select("feature")
      .eq("plan_tier", business.plan_tier);

    return {
      tier: business.plan_tier,
      features: (rows ?? []).map((r) => r.feature as PlatformFeature),
    };
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
