import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  emptySiteContent,
  siteContentSchema,
  weekHoursSchema,
  type TenantSiteContent,
} from "./tenant-site";

const SITE_COLUMNS =
  "tagline, about, address_line1, address_line2, city, region, postal_code, country, service_area, hours, booking_enabled, service_location";

type SiteRow = {
  tagline: string | null;
  about: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  service_area: string | null;
  hours: unknown;
  booking_enabled: boolean;
  service_location: string;
};

function toContent(row: SiteRow | null): TenantSiteContent {
  if (!row) return emptySiteContent();
  const hours = weekHoursSchema.safeParse(row.hours ?? {});
  return {
    tagline: row.tagline ?? "",
    about: row.about ?? "",
    addressLine1: row.address_line1 ?? "",
    addressLine2: row.address_line2 ?? "",
    city: row.city ?? "",
    region: row.region ?? "",
    postalCode: row.postal_code ?? "",
    country: row.country ?? "",
    serviceArea: row.service_area ?? "",
    hours: hours.success ? hours.data : {},
    bookingEnabled: row.booking_enabled,
    serviceLocation: row.service_location === "at_customer" ? "at_customer" : "at_business",
  };
}

function anonClient() {
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

/** Public website content for one resolved tenant. Anon-safe columns only. */
export const getTenantSite = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ businessId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<TenantSiteContent> => {
    const supabase = anonClient();
    if (!supabase) return emptySiteContent();
    const { data: row } = await supabase
      .from("business_site")
      .select(SITE_COLUMNS)
      .eq("business_id", data.businessId)
      .maybeSingle();
    return toContent((row as SiteRow | null) ?? null);
  });

async function callerBusinessId(context: { supabase: any; userId: string }) {
  const { data: membership } = await context.supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", context.userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (membership?.business_id as string | undefined) ?? null;
}

/** The caller's own site content, resolved from their membership. */
export const getMySiteContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TenantSiteContent | null> => {
    const businessId = await callerBusinessId(context);
    if (!businessId) return null;
    const { data: row } = await context.supabase
      .from("business_site")
      .select(SITE_COLUMNS)
      .eq("business_id", businessId)
      .maybeSingle();
    return toContent((row as SiteRow | null) ?? null);
  });

/**
 * Update the caller's own website content. The tenant id comes from their
 * membership, never from the browser, and the write still passes the manager
 * RLS policy on business_site.
 */
export const updateMySiteContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => siteContentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const businessId = await callerBusinessId(context);
    if (!businessId) throw new Error("No business is linked to your account yet.");

    const { error } = await context.supabase.from("business_site").upsert(
      {
        business_id: businessId,
        tagline: data.tagline || null,
        about: data.about || null,
        address_line1: data.addressLine1 || null,
        address_line2: data.addressLine2 || null,
        city: data.city || null,
        region: data.region || null,
        postal_code: data.postalCode || null,
        country: data.country || null,
        service_area: data.serviceArea || null,
        hours: data.hours,
        booking_enabled: data.bookingEnabled,
        service_location: data.serviceLocation,
      },
      { onConflict: "business_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
