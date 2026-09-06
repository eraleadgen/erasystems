import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

/**
 * Public booking request from a tenant's own marketing site.
 *
 * Runs with the publishable (anon) key, so the "public may request a booking on
 * an active tenant" policy is the security boundary: the row must be pending,
 * unassigned, and belong to an active business. Pricing is recomputed here from
 * the catalog; the browser never dictates an amount.
 */

const input = z.object({
  businessId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1).max(12),
  // Trade-specific surcharge (e.g. vehicle condition). Ordinary businesses send 1.
  conditionMultiplier: z.number().min(1).max(2).optional().default(1),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().min(7).max(40),
  customerEmail: z.string().trim().max(160).optional().default(""),
  vehicle: z.string().trim().max(120).optional().default(""),
  // Only businesses that travel to the customer collect an address.
  address: z.string().trim().max(240).optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
  startsAt: z.string().datetime(),
  specialistId: z.string().uuid().nullable().optional().default(null),
});

function anonClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Backend is not configured");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (i, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(i, { ...init, headers });
      },
    },
  });
}

/**
 * One guarded database step does the whole thing: it checks the business is
 * live, prices the job from that business's own catalog, matches or creates the
 * customer record, and writes the booking. The browser never dictates an amount
 * and anon has no direct write access to bookings or customers.
 */
export const requestTenantBooking = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data }) => {
    const supabase = anonClient();

    const { data: rows, error } = await supabase.rpc("request_tenant_booking", {
      _business_id: data.businessId,
      _service_ids: data.serviceIds,
      _multiplier: data.conditionMultiplier,
      _customer_name: data.customerName,
      _customer_phone: data.customerPhone,
      _customer_email: data.customerEmail,
      _address: data.address,
      _subject: data.vehicle ? `Vehicle: ${data.vehicle}` : "",
      _notes: data.notes,
      _starts_at: new Date(data.startsAt).toISOString(),
      _specialist_id: data.specialistId ?? undefined,
    });
    if (error) throw new Error(error.message);

    const result = Array.isArray(rows) ? rows[0] : rows;
    return {
      ok: true,
      totalCents: result?.total_cents ?? 0,
      minutes: result?.minutes ?? 0,
    };
  });

/** Active specialists a customer can pick from, with the services they cover. */
export const listTenantSpecialists = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) => z.object({ businessId: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const supabase = anonClient();
    const { data: specialists } = await supabase
      .from("specialist_profiles")
      .select("id, display_name, title")
      .eq("business_id", data.businessId)
      .eq("is_active", true)
      .order("display_name", { ascending: true });

    const ids = (specialists ?? []).map((s) => s.id);
    const { data: coverage } = ids.length
      ? await supabase.from("specialist_services").select("specialist_id, service_id").in("specialist_id", ids)
      : { data: [] as { specialist_id: string; service_id: string }[] };

    return (specialists ?? []).map((s) => ({
      id: s.id,
      displayName: s.display_name,
      title: s.title,
      serviceIds: (coverage ?? []).filter((c) => c.specialist_id === s.id).map((c) => c.service_id),
    }));
  });

