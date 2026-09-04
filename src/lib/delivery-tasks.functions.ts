import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DELIVERY_STATUSES, type DeliveryStatus } from "./delivery-tasks";

const businessIdInput = z.object({ businessId: z.string().uuid() });

export type DeliveryTaskRow = {
  taskKey: string;
  status: DeliveryStatus;
  notes: string;
  completedAt: string | null;
  updatedAt: string;
};

/**
 * Staff delivery checklist for one client. `client_delivery_tasks` is staff-only
 * at the RLS layer, and every query is scoped to the requested business_id.
 */
export const getDeliveryTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessIdInput.parse(input))
  .handler(async ({ data, context }): Promise<DeliveryTaskRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("client_delivery_tasks")
      .select("task_key, status, notes, completed_at, updated_at")
      .eq("business_id", data.businessId);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      taskKey: r.task_key,
      status: r.status as DeliveryStatus,
      notes: r.notes ?? "",
      completedAt: r.completed_at,
      updatedAt: r.updated_at,
    }));
  });

const setInput = businessIdInput.extend({
  taskKey: z.string().min(1).max(80),
  status: z.enum(DELIVERY_STATUSES),
  notes: z.string().max(2000).optional(),
});

/**
 * Flip one checklist step. Authorization is the `is_platform_staff()` RLS policy
 * on client_delivery_tasks: a client writing here gets a policy violation.
 */
export const setDeliveryTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_delivery_tasks").upsert(
      {
        business_id: data.businessId,
        task_key: data.taskKey,
        status: data.status,
        notes: data.notes ?? null,
        completed_at: data.status === "done" ? new Date().toISOString() : null,
      },
      { onConflict: "business_id,task_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
