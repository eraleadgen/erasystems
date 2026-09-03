import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const LAUNCH_STATUSES = ["pending", "in_progress", "live"] as const;
export type LaunchStatus = (typeof LAUNCH_STATUSES)[number];

export type LaunchStatusRow = { itemKey: string; status: LaunchStatus; updatedAt: string };

const businessIdInput = z.object({ businessId: z.string().uuid() });

/**
 * Build status per capability. Read is RLS-scoped to members of that business
 * (and platform staff) through the same business_id predicates used elsewhere.
 */
export const getLaunchStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessIdInput.parse(input))
  .handler(async ({ data, context }): Promise<LaunchStatusRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("business_launch_status")
      .select("item_key, status, updated_at")
      .eq("business_id", data.businessId);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      itemKey: r.item_key,
      status: r.status as LaunchStatus,
      updatedAt: r.updated_at,
    }));
  });

const setInput = businessIdInput.extend({
  itemKey: z.string().min(1).max(80),
  status: z.enum(LAUNCH_STATUSES),
});

/**
 * Staff-controlled status flip. Authorization is the RLS policy
 * `is_platform_staff()` on business_launch_status: a client writing here gets a
 * policy violation, not a silent success.
 */
export const setLaunchStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("business_launch_status").upsert(
      {
        business_id: data.businessId,
        item_key: data.itemKey,
        status: data.status,
      },
      { onConflict: "business_id,item_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
