import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { PlatformFeature, TenantEntitlements } from "./entitlements";

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

/**
 * Server-only tier resolution. Not exported as a server function: the resolved
 * matrix is tenant-internal commercial information and must not be reachable as
 * an unauthenticated RPC. Route gating exposes only a boolean.
 */
export async function fetchTierEntitlements(
  businessId: string,
): Promise<TenantEntitlements | null> {
  const supabase = publicClient();
  if (!supabase) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("plan_tier")
    .eq("id", businessId)
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
}
