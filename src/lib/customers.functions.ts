import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Customer records for a business.
 *
 * Every read and write goes through the caller's own RLS-scoped client, so the
 * business_id predicates in the policies are the security boundary: a manager
 * sees their own tenant's customers, a customer sees only their own row, and
 * nobody sees another business's records — even when the email or phone is
 * identical, because a customer row belongs to exactly one business.
 */

export type CustomerRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  hasLogin: boolean;
  inviteePending: boolean;
  bookingCount: number;
  lastBookingAt: string | null;
  lifetimeCents: number;
};

export type CustomerBooking = {
  id: string;
  startsAt: string;
  status: string;
  totalCents: number;
  notes: string | null;
  specialistName: string | null;
};

async function callerBusinessId(context: {
  supabase: {
    from: (t: "business_members") => {
      select: (c: string) => {
        eq: (
          c: string,
          v: string,
        ) => {
          order: (
            c: string,
            o: { ascending: boolean },
          ) => {
            limit: (n: number) => { maybeSingle: () => Promise<{ data: { business_id: string; role: string } | null }> };
          };
        };
      };
    };
  };
  userId: string;
}): Promise<{ businessId: string; role: string } | null> {
  const { data } = await context.supabase
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", context.userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ? { businessId: data.business_id, role: data.role } : null;
}

/** The business's own customer list, with booking history rolled up. */
export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CustomerRow[]> => {
    const membership = await callerBusinessId(context as never);
    if (!membership) return [];

    const [{ data: customers }, { data: bookings }] = await Promise.all([
      context.supabase
        .from("customers")
        .select("id, full_name, email, phone, notes, user_id, invite_token_hash")
        .eq("business_id", membership.businessId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("bookings")
        .select("customer_id, starts_at, total_cents")
        .eq("business_id", membership.businessId),
    ]);

    const stats = new Map<string, { count: number; last: string | null; cents: number }>();
    for (const b of bookings ?? []) {
      if (!b.customer_id) continue;
      const entry = stats.get(b.customer_id) ?? { count: 0, last: null, cents: 0 };
      entry.count += 1;
      entry.cents += b.total_cents;
      if (!entry.last || b.starts_at > entry.last) entry.last = b.starts_at;
      stats.set(b.customer_id, entry);
    }

    return (customers ?? []).map((c) => {
      const s = stats.get(c.id);
      return {
        id: c.id,
        fullName: c.full_name,
        email: c.email,
        phone: c.phone,
        notes: c.notes,
        hasLogin: Boolean(c.user_id),
        inviteePending: Boolean(c.invite_token_hash),
        bookingCount: s?.count ?? 0,
        lastBookingAt: s?.last ?? null,
        lifetimeCents: s?.cents ?? 0,
      };
    });
  });

/** One customer's full booking history, scoped to the caller's business. */
export const getCustomerBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ customerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<CustomerBooking[]> => {
    const membership = await callerBusinessId(context as never);
    if (!membership) return [];

    const { data: rows } = await context.supabase
      .from("bookings")
      .select("id, starts_at, status, total_cents, notes, specialist_profiles(display_name)")
      .eq("business_id", membership.businessId)
      .eq("customer_id", data.customerId)
      .order("starts_at", { ascending: false });

    return (rows ?? []).map((r) => ({
      id: r.id,
      startsAt: r.starts_at,
      status: r.status,
      totalCents: r.total_cents,
      notes: r.notes,
      specialistName:
        (r as { specialist_profiles?: { display_name: string } | null }).specialist_profiles
          ?.display_name ?? null,
    }));
  });

const saveInput = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().max(160).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
});

/** Create or correct a customer record. RLS restricts this to owners/admins. */
export const saveCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveInput.parse(input))
  .handler(async ({ data, context }) => {
    const membership = await callerBusinessId(context as never);
    if (!membership) throw new Error("No business found for your account.");

    const payload = {
      business_id: membership.businessId,
      full_name: data.fullName,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
    };

    if (data.id) {
      const { error } = await context.supabase
        .from("customers")
        .update(payload)
        .eq("id", data.id)
        .eq("business_id", membership.businessId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }

    const { data: row, error } = await context.supabase
      .from("customers")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

/**
 * Manual merge for the case automatic matching deliberately refuses to guess:
 * the same person booked twice with two slightly different emails. Bookings
 * move to the surviving record; the duplicate is deleted. Both records must
 * belong to the caller's business.
 */
export const mergeCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ keepId: z.string().uuid(), mergeId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.keepId === data.mergeId) throw new Error("Pick two different customers.");
    const membership = await callerBusinessId(context as never);
    if (!membership) throw new Error("No business found for your account.");

    const { data: both } = await context.supabase
      .from("customers")
      .select("id")
      .eq("business_id", membership.businessId)
      .in("id", [data.keepId, data.mergeId]);
    if ((both ?? []).length !== 2) throw new Error("Those customers are not in your business.");

    const { error: moveError } = await context.supabase
      .from("bookings")
      .update({ customer_id: data.keepId })
      .eq("business_id", membership.businessId)
      .eq("customer_id", data.mergeId);
    if (moveError) throw new Error(moveError.message);

    const { error } = await context.supabase
      .from("customers")
      .delete()
      .eq("id", data.mergeId)
      .eq("business_id", membership.businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Issue a single-use portal link for a customer. Only the SHA-256 hash is
 * stored; the plaintext is returned once for the owner to send on.
 */
export const inviteCustomerToPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ customerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ token: string }> => {
    const membership = await callerBusinessId(context as never);
    if (!membership) throw new Error("No business found for your account.");

    const { generateInviteToken, hashInviteToken, expiryFromNow } = await import(
      "./invites.server"
    );
    const token = generateInviteToken();
    const tokenHash = await hashInviteToken(token);

    const { error } = await context.supabase
      .from("customers")
      .update({ invite_token_hash: tokenHash, invite_expires_at: expiryFromNow(14) })
      .eq("id", data.customerId)
      .eq("business_id", membership.businessId)
      .is("user_id", null);
    if (error) throw new Error(error.message);

    return { token };
  });

/** Bind the signed-in account to the customer record the token points at. */
export const claimCustomerPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().min(10).max(200) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean }> => {
    const { hashInviteToken, failureDelay } = await import("./invites.server");
    const tokenHash = await hashInviteToken(data.token);
    const { data: businessId, error } = await context.supabase.rpc("claim_customer_account", {
      _token_hash: tokenHash,
    });
    if (error || !businessId) {
      await failureDelay();
      return { ok: false };
    }
    return { ok: true };
  });

export type MyBooking = {
  id: string;
  startsAt: string;
  status: string;
  totalCents: number;
  notes: string | null;
  specialistName: string | null;
};

/**
 * The signed-in customer's own bookings for ONE business.
 *
 * Two filters, both required: RLS only exposes bookings whose customer row is
 * linked to this login, and the query is additionally pinned to the business
 * whose site the customer is on. A person who is a customer of two ERA clients
 * sees each business's history only on that business's own portal.
 */
export const getMyCustomerBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ businessId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ name: string; bookings: MyBooking[] } | null> => {
    const { data: customer } = await context.supabase
      .from("customers")
      .select("id, full_name")
      .eq("business_id", data.businessId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!customer) return null;

    const { data: rows } = await context.supabase
      .from("bookings")
      .select("id, starts_at, status, total_cents, notes, specialist_profiles(display_name)")
      .eq("business_id", data.businessId)
      .eq("customer_id", customer.id)
      .order("starts_at", { ascending: false });

    return {
      name: customer.full_name,
      bookings: (rows ?? []).map((r) => ({
        id: r.id,
        startsAt: r.starts_at,
        status: r.status,
        totalCents: r.total_cents,
        notes: r.notes,
        specialistName:
          (r as { specialist_profiles?: { display_name: string } | null }).specialist_profiles
            ?.display_name ?? null,
      })),
    };
  });
