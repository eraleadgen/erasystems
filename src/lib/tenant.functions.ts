import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { getRequestHostname, isPlatformHostname, normalizeHostname } from "./tenant-hostname";

export type ResolvedTenant = {
  businessId: string;
  slug: string;
  name: string;
  timezone: string;
  planTier: Database["public"]["Enums"]["plan_tier"];
  logoUrl: string | null;
  brandPrimary: string | null;
  brandAccent: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  /** hostname the resolution was based on, for diagnostics */
  hostname: string | null;
  /** true when we are on a platform host (preview/dev) rather than a tenant domain */
  isPlatformHost: boolean;
};

const previewOverrideSchema = z
  .object({ tenant: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/).optional() })
  .optional();

/**
 * Resolves the tenant for the current request, server-side, before anything renders.
 *
 * Trust model: the hostname comes only from edge-injected headers (see tenant-hostname.ts).
 * This picks WHICH tenant a request belongs to. It is NOT an authorization decision —
 * every read of tenant data is still gated by RLS membership checks in Postgres, so a
 * wrong or spoofed resolution yields no private data, only a wrong public site.
 *
 * The `tenant` slug override is honoured ONLY on platform hostnames (preview/dev), where
 * no tenant domain exists. It selects among publicly-readable rows only.
 */
export const resolveTenant = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => previewOverrideSchema.parse(input ?? {}))
  .handler(async ({ data }): Promise<ResolvedTenant | null> => {
    const request = getRequest();
    const hostname = getRequestHostname(request);
    const platformHost = isPlatformHostname(hostname);

    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return null;

    const supabasePublic = createClient<Database>(url, key, {
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

    let businessId: string | null = null;

    if (!platformHost) {
      const normalized = normalizeHostname(hostname);
      if (!normalized) return null;
      const { data: domain } = await supabasePublic
        .from("business_domains")
        .select("business_id")
        .eq("hostname", normalized)
        .maybeSingle();
      // Unknown hostname resolves to nothing. Never fall back to a default tenant.
      if (!domain) return null;
      businessId = domain.business_id;
    }

    const query = supabasePublic
      .from("businesses")
      .select(
        "id, slug, name, timezone, plan_tier, logo_url, brand_primary, brand_accent, support_email, support_phone",
      )
      .eq("is_active", true);

    // No implicit default tenant. A platform host with no explicit slug resolves
    // to nothing, so the marketing site renders instead of some arbitrary business.
    const { data: business } = businessId
      ? await query.eq("id", businessId).maybeSingle()
      : data?.tenant
        ? await query.eq("slug", data.tenant).maybeSingle()
        : { data: null };

    if (!business) return null;

    // A client's public site stays dark until staff mark the website live in
    // the delivery checklist. Staff previews (?tenant= on a platform host) are
    // deliberately exempt so an unfinished site can still be reviewed.
    if (businessId) {
      const { data: isLive } = await supabasePublic.rpc("tenant_site_is_live", {
        _business_id: businessId,
      });
      if (!isLive) return null;
    }


    return {
      businessId: business.id,
      slug: business.slug,
      name: business.name,
      timezone: business.timezone,
      planTier: business.plan_tier,
      logoUrl: business.logo_url,
      brandPrimary: business.brand_primary,
      brandAccent: business.brand_accent,
      supportEmail: business.support_email,
      supportPhone: business.support_phone,
      hostname,
      isPlatformHost: platformHost,
    };
  });

/** Public catalog for a resolved tenant. Anon-safe columns only. */
export const getTenantServices = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ businessId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return [];

    const supabasePublic = createClient<Database>(url, key, {
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

    const { data: services } = await supabasePublic
      .from("services")
      .select("id, name, description, base_price_cents, duration_minutes")
      .eq("business_id", data.businessId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    return services ?? [];
  });
