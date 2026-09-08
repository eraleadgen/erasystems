import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/**
 * Installable-app identity for one business.
 *
 * The database function behind this returns a row ONLY when the business is
 * live and has the Downloadable Apps (white_label_branding) add-on active, so
 * gating cannot drift between the manifest, the icon and the install prompt.
 * It exposes nothing but the branding that already appears on that business's
 * own public website.
 */
export type AppIdentity = {
  businessId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  brandPrimary: string;
  brandAccent: string;
};

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

function shape(row: any | null | undefined): AppIdentity | null {
  if (!row) return null;
  return {
    businessId: row.business_id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url ?? null,
    brandPrimary: row.brand_primary || "#0f766e",
    brandAccent: row.brand_accent || row.brand_primary || "#0f766e",
  };
}

export async function appIdentityById(businessId: string): Promise<AppIdentity | null> {
  const supabase = publicClient();
  if (!supabase) return null;
  const { data } = await supabase.rpc("app_identity", { _business_id: businessId });
  return shape(Array.isArray(data) ? data[0] : data);
}

export async function appIdentityForHost(hostname: string): Promise<AppIdentity | null> {
  const supabase = publicClient();
  if (!supabase) return null;
  const { data } = await supabase.rpc("app_identity_for_host", { _hostname: hostname });
  return shape(Array.isArray(data) ? data[0] : data);
}

/** Initials used for the generated icon when a business has no logo yet. */
export function monogram(name: string): string {
  const words = name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const first = words[0];
  if (!first) return "•";
  const second = words[1];
  if (!second) return first.slice(0, 2).toUpperCase();
  return `${first[0]}${second[0]}`.toUpperCase();
}
