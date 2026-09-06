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

export const requestTenantBooking = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => input.parse(raw))
  .handler(async ({ data }) => {
    const supabase = anonClient();

    const { data: services, error: servicesError } = await supabase
      .from("services")
      .select("id, name, base_price_cents, duration_minutes")
      .eq("business_id", data.businessId)
      .eq("is_active", true)
      .in("id", data.serviceIds);
    if (servicesError) throw new Error(servicesError.message);
    if (!services || services.length === 0) throw new Error("Select at least one service");

    const subtotal = services.reduce((sum, s) => sum + s.base_price_cents, 0);
    const total = Math.round(subtotal * data.conditionMultiplier);
    const minutes = services.reduce((sum, s) => sum + s.duration_minutes, 0);

    const startsAt = new Date(data.startsAt);
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now()) {
      throw new Error("Choose a date in the future");
    }
    const endsAt = new Date(startsAt.getTime() + minutes * 60000);

    const summary = [
      `Services: ${services.map((s) => s.name).join(", ")}`,
      data.vehicle ? `Vehicle: ${data.vehicle}` : null,
      `Address: ${data.address}`,
      data.notes ? `Notes: ${data.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const { error } = await supabase.from("bookings").insert({
      business_id: data.businessId,
      customer_name: data.customerName,
      customer_email: data.customerEmail || null,
      customer_phone: data.customerPhone,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "pending",
      total_cents: total,
      notes: summary,
    });
    if (error) throw new Error(error.message);

    return { ok: true, totalCents: total, minutes };
  });
