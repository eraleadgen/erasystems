import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AI_AGENT_TRACKS,
  AI_STEP_STATUSES,
  type AiAgentDelivery,
  type AiAgentStepRow,
  type AiAgentTrack,
  type AiStepStatus,
} from "@/lib/ai-agents";

const businessIdInput = z.object({ businessId: z.string().uuid() });

/**
 * AI agent delivery state for one business. Every read is explicitly
 * business_id scoped and goes through the caller's RLS-scoped client: members
 * of that business and platform staff, nobody else. No elevated access.
 */
export const getAiAgentDelivery = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessIdInput.parse(input))
  .handler(async ({ data, context }): Promise<AiAgentDelivery> => {
    const [tracks, steps] = await Promise.all([
      context.supabase
        .from("business_ai_agent_tracks")
        .select("track, is_enabled")
        .eq("business_id", data.businessId),
      context.supabase
        .from("business_ai_agent_steps")
        .select("track, step_key, status, note, updated_at")
        .eq("business_id", data.businessId),
    ]);
    if (tracks.error) throw new Error(tracks.error.message);
    if (steps.error) throw new Error(steps.error.message);

    return {
      businessId: data.businessId,
      enabledTracks: (tracks.data ?? [])
        .filter((t) => t.is_enabled)
        .map((t) => t.track as AiAgentTrack),
      steps: (steps.data ?? []).map(
        (s): AiAgentStepRow => ({
          track: s.track as AiAgentTrack,
          stepKey: s.step_key,
          status: s.status as AiStepStatus,
          note: s.note,
          updatedAt: s.updated_at,
        }),
      ),
    };
  });

const trackInput = businessIdInput.extend({
  track: z.enum(AI_AGENT_TRACKS),
  isEnabled: z.boolean(),
});

/**
 * Staff-only scoping switch: is this client actually getting this agent?
 * Authorization is the is_platform_staff() policy on the table, so a client
 * calling this gets a policy violation rather than a silent success.
 */
export const setAiAgentTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => trackInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("business_ai_agent_tracks").upsert(
      {
        business_id: data.businessId,
        track: data.track,
        is_enabled: data.isEnabled,
      },
      { onConflict: "business_id,track" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const stepInput = businessIdInput.extend({
  track: z.enum(AI_AGENT_TRACKS),
  stepKey: z.string().min(1).max(80),
  status: z.enum(AI_STEP_STATUSES),
  note: z.string().max(500).nullable().optional(),
});

/** Staff-only manual status flip for one step of one track. */
export const setAiAgentStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => stepInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("business_ai_agent_steps").upsert(
      {
        business_id: data.businessId,
        track: data.track,
        step_key: data.stepKey,
        status: data.status,
        note: data.note ?? null,
      },
      { onConflict: "business_id,track,step_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
