import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Partner / referral network — Enterprise.
 *
 * Every read and write goes through the caller's own RLS-scoped client and is
 * resolved from their own membership row, never from the request body. The
 * "referrals sent" list comes from a guarded database function that returns no
 * customer detail at all: a referrer sees which business served the job, when,
 * its status and its value, and nothing else.
 */

export type ReferralRow = {
  bookingId: string;
  receivedByName: string;
  startsAt: string;
  status: string;
  totalCents: number;
  createdAt: string;
};

export type ReferralSummary = {
  businessId: string;
  code: string | null;
  isActive: boolean;
  referrals: ReferralRow[];
  totals: { count: number; completed: number; valueCents: number };
};

async function callerBusinessId(
  supabase: { from: (t: "business_members") => any },
  userId: string,
): Promise<{ businessId: string; role: string } | null> {
  const { data } = await supabase
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ? { businessId: data.business_id, role: data.role } : null;
}

export const getMyReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReferralSummary | null> => {
    const membership = await callerBusinessId(context.supabase as never, context.userId);
    if (!membership) return null;
    const businessId = membership.businessId;

    const [codeRow, sent] = await Promise.all([
      context.supabase
        .from("business_referral_codes")
        .select("code, is_active")
        .eq("business_id", businessId)
        .maybeSingle(),
      context.supabase.rpc("referrals_sent", { _business_id: businessId }),
    ]);

    const referrals: ReferralRow[] = (sent.data ?? []).map((r: any) => ({
      bookingId: r.booking_id,
      receivedByName: r.received_by_name,
      startsAt: r.starts_at,
      status: r.status,
      totalCents: r.total_cents,
      createdAt: r.created_at,
    }));

    return {
      businessId,
      code: codeRow.data?.code ?? null,
      isActive: codeRow.data?.is_active ?? false,
      referrals,
      totals: {
        count: referrals.length,
        completed: referrals.filter((r) => r.status === "completed").length,
        valueCents: referrals
          .filter((r) => r.status === "completed" || r.status === "confirmed")
          .reduce((sum, r) => sum + r.totalCents, 0),
      },
    };
  });

const codeInput = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{4,24}$/, "Use 4–24 letters, numbers or dashes."),
});

/** Creates (or replaces) the caller's own referral code. Managers only, by policy. */
export const setMyReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => codeInput.parse(raw))
  .handler(async ({ context, data }) => {
    const membership = await callerBusinessId(context.supabase as never, context.userId);
    if (!membership) throw new Error("No business found for this account.");

    const { error } = await context.supabase
      .from("business_referral_codes")
      .upsert(
        { business_id: membership.businessId, code: data.code, is_active: true },
        { onConflict: "business_id" },
      );
    if (error) {
      throw new Error(
        error.code === "23505" ? "That code is already taken — try another." : error.message,
      );
    }
    return { ok: true, code: data.code };
  });

export const setMyReferralActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ isActive: z.boolean() }).parse(raw))
  .handler(async ({ context, data }) => {
    const membership = await callerBusinessId(context.supabase as never, context.userId);
    if (!membership) throw new Error("No business found for this account.");
    const { error } = await context.supabase
      .from("business_referral_codes")
      .update({ is_active: data.isActive })
      .eq("business_id", membership.businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
