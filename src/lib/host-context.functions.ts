import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { getRequestHostname, isPlatformHostname, normalizeHostname } from "./tenant-hostname";

/**
 * Is the current request arriving on a client's own domain?
 *
 * ERA-only marketing pages (pricing, contact, the ERA proof pages) must not be
 * reachable on a client's domain: that address belongs to the client, and ERA's
 * pricing/branding appearing there is a cross-tenant content leak.
 */
export const isTenantHost = createServerFn({ method: "GET" }).handler(async (): Promise<boolean> => {
  const hostname = normalizeHostname(getRequestHostname(getRequest()));
  if (!hostname || isPlatformHostname(hostname)) return false;

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return false;

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

  const { data } = await supabasePublic
    .from("business_domains")
    .select("business_id")
    .eq("hostname", hostname)
    .maybeSingle();

  return Boolean(data);
});
