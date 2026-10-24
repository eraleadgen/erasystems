import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_AGENT_TRACKS, type AiAgentTrack } from "@/lib/ai-agents";
import { PLAN_PRICING } from "@/lib/pricing";
import type { PlanTier } from "@/lib/entitlements";

const TIERS = ["basic", "growth", "enterprise"] as const;
const TIER_RANK: Record<PlanTier, number> = { basic: 0, growth: 1, enterprise: 2 };
const TRACK_LABEL: Record<AiAgentTrack, string> = { ai_sms: "AI SMS agent", ai_voice: "AI voice agent" };

export interface ScheduledChange {
  id: string;
  kind: "change" | "cancel";
  fromTier: PlanTier;
  toTier: PlanTier | null;
  effectiveAt: string;
}

export interface PlanStatus {
  businessId: string;
  tier: PlanTier;
  lifecycle: string;
  periodEnd: string | null;
  scheduled: ScheduledChange | null;
  aiAgentsAvailable: boolean;
  aiTracks: Record<AiAgentTrack, boolean>;
}

const businessInput = z.object({ businessId: z.string().uuid() });

type Ctx = { supabase: any; userId: string };

/** Months in one ERA billing period; null = not recurring (one_time or unknown). */
export function intervalMonths(interval: string): number | null {
  if (interval === "monthly") return 1;
  if (interval === "quarterly") return 3;
  if (interval === "annual") return 12;
  return null;
}

/**
 * End of the current paid period. Stripe's own current_period_end wins when we
 * have it; otherwise roll the first activation date forward by whole periods.
 */
export function computePeriodEnd(
  anchorIso: string | null,
  interval: string,
  stripePeriodEnd: string | null,
  now: Date = new Date(),
): Date | null {
  if (stripePeriodEnd) return new Date(stripePeriodEnd);
  const step = intervalMonths(interval);
  if (!step || !anchorIso) return null;
  const anchor = new Date(anchorIso);
  const end = new Date(anchor);
  let n = 0;
  while (end <= now && n < 1200) {
    n += step;
    end.setTime(anchor.getTime());
    end.setUTCMonth(anchor.getUTCMonth() + n);
  }
  return end;
}

/** Mirrors a scheduled cancellation onto Stripe. Throws if Stripe refuses. */
async function syncStripeCancel(ctx: Ctx, businessId: string, cancel: boolean) {
  const { data } = await ctx.supabase
    .from("business_billing")
    .select("stripe_subscription_id")
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data?.stripe_subscription_id) return;
  const { setStripeCancelAtPeriodEnd } = await import("./payments.server");
  await setStripeCancelAtPeriodEnd(data.stripe_subscription_id, cancel);
}

async function loadStatus(ctx: Ctx, businessId: string): Promise<PlanStatus> {
  const [biz, pay, req, tracks, billing] = await Promise.all([
    ctx.supabase.from("businesses").select("id, name, plan_tier, lifecycle, origin_invite_id").eq("id", businessId).maybeSingle(),
    ctx.supabase
      .from("payments")
      .select("activated_at")
      .eq("business_id", businessId)
      .not("activated_at", "is", null)
      .order("activated_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    ctx.supabase
      .from("plan_change_requests")
      .select("id, kind, from_tier, to_tier, effective_at")
      .eq("business_id", businessId)
      .eq("status", "scheduled")
      .maybeSingle(),
    ctx.supabase.from("business_ai_agent_tracks").select("track, is_enabled").eq("business_id", businessId),
    ctx.supabase.from("business_billing").select("current_period_end").eq("business_id", businessId).maybeSingle(),
  ]);
  if (biz.error || !biz.data) throw new Error("Business not found.");
  const tier = biz.data.plan_tier as PlanTier;

  let interval = "monthly";
  if (biz.data.origin_invite_id) {
    const { data } = await ctx.supabase
      .from("invites")
      .select("billing_interval")
      .eq("id", biz.data.origin_invite_id)
      .maybeSingle();
    if (data?.billing_interval) interval = data.billing_interval;
  }

  const anchor = (pay.data?.activated_at as string | undefined) ?? null;
  const periodEnd = computePeriodEnd(anchor, interval, (billing.data?.current_period_end as string | null) ?? null);
  const aiTracks: Record<AiAgentTrack, boolean> = { ai_sms: false, ai_voice: false };
  for (const t of tracks.data ?? []) aiTracks[t.track as AiAgentTrack] = Boolean(t.is_enabled);

  return {
    businessId,
    tier,
    lifecycle: biz.data.lifecycle,
    periodEnd: periodEnd ? periodEnd.toISOString() : null,
    scheduled: req.data
      ? {
          id: req.data.id,
          kind: req.data.kind,
          fromTier: req.data.from_tier,
          toTier: req.data.to_tier,
          effectiveAt: req.data.effective_at,
        }
      : null,
    aiAgentsAvailable: tier === "enterprise",
    aiTracks,
  };
}

async function businessName(ctx: Ctx, businessId: string): Promise<string> {
  const { data } = await ctx.supabase.from("businesses").select("name").eq("id", businessId).maybeSingle();
  return data?.name ?? "A client";
}

async function callerEmail(ctx: Ctx): Promise<string | undefined> {
  const { data } = await ctx.supabase.auth.getUser();
  return data?.user?.email ?? undefined;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });

export const getPlanStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => loadStatus(context, data.businessId));

const scheduleInput = businessInput.extend({
  kind: z.enum(["change", "cancel"]),
  toTier: z.enum(TIERS).nullable(),
});

/** Schedules an upgrade, downgrade or cancellation for the end of the current paid period. */
export const schedulePlanChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => scheduleInput.parse(input))
  .handler(async ({ data, context }) => {
    const status = await loadStatus(context, data.businessId);
    if (status.lifecycle !== "active") throw new Error("Plan changes are available once your account is active.");
    if (!status.periodEnd) throw new Error("We couldn't find your billing period. Contact support@eraleadgen.com.");
    if (status.scheduled) throw new Error("You already have a scheduled change. Withdraw it first.");
    if (data.kind === "change") {
      if (!data.toTier || data.toTier === status.tier) throw new Error("Choose a different plan.");
    }
    const toTier = data.kind === "change" ? data.toTier : null;

    // Stripe first: if it refuses, nothing is recorded and the client is told.
    if (data.kind === "cancel") {
      try {
        await syncStripeCancel(context, data.businessId, true);
      } catch (error) {
        console.error("stripe cancel sync failed", error instanceof Error ? error.message : error);
        throw new Error(
          "We couldn't cancel your subscription with our payment provider, so nothing was changed. Please try again or contact support@eraleadgen.com.",
        );
      }
    }

    const { data: row, error } = await context.supabase
      .from("plan_change_requests")
      .insert({
        business_id: data.businessId,
        requested_by: context.userId,
        kind: data.kind,
        from_tier: status.tier,
        to_tier: toTier,
        effective_at: status.periodEnd,
      })
      .select("id")
      .single();
    if (error || !row) {
      if (data.kind === "cancel") {
        await syncStripeCancel(context, data.businessId, false).catch((e) =>
          console.error("stripe cancel revert failed", e instanceof Error ? e.message : e),
        );
      }
      throw new Error("Couldn't schedule that change. Try again.");
    }

    const name = await businessName(context, data.businessId);
    const from = PLAN_PRICING[status.tier].name;
    const direction = toTier ? (TIER_RANK[toTier] > TIER_RANK[status.tier] ? "Upgrade" : "Downgrade") : null;
    const { sendStaffAlert } = await import("./staff-alerts.server");
    await sendStaffAlert({
      title: data.kind === "cancel" ? "Client cancelled their subscription" : `${direction} scheduled`,
      businessId: data.businessId,
      businessName: name,
      summary:
        data.kind === "cancel"
          ? `The client cancelled. They keep access until ${fmt(status.periodEnd)}, then their account goes offline.`
          : `The client scheduled a change from ${from} to ${PLAN_PRICING[toTier!].name}. Update their billing to match before ${fmt(status.periodEnd)}.`,
      details: [
        { label: "Current plan", value: from },
        ...(toTier ? [{ label: "New plan", value: PLAN_PRICING[toTier].name }] : []),
        { label: "Takes effect", value: fmt(status.periodEnd) },
      ],
      idempotencyKey: `plan-change-${row.id}`,
      replyTo: await callerEmail(context),
    });
    return loadStatus(context, data.businessId);
  });

export const withdrawPlanChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("plan_change_requests")
      .update({ status: "withdrawn" })
      .eq("business_id", data.businessId)
      .eq("status", "scheduled")
      .select("id, kind, to_tier")
      .maybeSingle();
    if (error) throw new Error("Couldn't withdraw that change. Try again.");
    if (row) {
      if (row.kind === "cancel") {
        await syncStripeCancel(context, data.businessId, false).catch((e) =>
          console.error("stripe cancel sync failed", e instanceof Error ? e.message : e),
        );
      }
      const { sendStaffAlert } = await import("./staff-alerts.server");
      await sendStaffAlert({
        title: row.kind === "cancel" ? "Client withdrew their cancellation" : "Client withdrew a plan change",
        businessId: data.businessId,
        businessName: await businessName(context, data.businessId),
        summary: "The scheduled change was withdrawn. Their plan stays as it is.",
        idempotencyKey: `plan-change-withdrawn-${row.id}`,
        replyTo: await callerEmail(context),
      });
    }
    return loadStatus(context, data.businessId);
  });

const aiInput = businessInput.extend({ track: z.enum(AI_AGENT_TRACKS), enabled: z.boolean() });

/** Client turns an Enterprise AI agent on or off. Authorization lives in the set_ai_agent_choice RPC. */
export const setMyAiAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => aiInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_ai_agent_choice", {
      _business_id: data.businessId,
      _track: data.track,
      _enabled: data.enabled,
    });
    if (error) throw new Error(error.message.includes("Enterprise") ? error.message : "Couldn't save that choice.");
    const { sendStaffAlert } = await import("./staff-alerts.server");
    await sendStaffAlert({
      title: `${TRACK_LABEL[data.track]} turned ${data.enabled ? "on" : "off"}`,
      businessId: data.businessId,
      businessName: await businessName(context, data.businessId),
      summary: data.enabled
        ? `The client wants to use the ${TRACK_LABEL[data.track]}. Start or resume setup.`
        : `The client no longer wants the ${TRACK_LABEL[data.track]}. Stop it on their account.`,
      idempotencyKey: `ai-choice-${data.businessId}-${data.track}-${data.enabled}-${Date.now()}`,
      replyTo: await callerEmail(context),
    });
    return loadStatus(context, data.businessId);
  });
