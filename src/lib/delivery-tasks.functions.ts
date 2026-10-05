import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ALL_DELIVERY_TASKS,
  DELIVERY_STATUSES,
  applicableTasks,
  assistedActionFor,
  automationFor,
  type DeliveryStatus,
} from "./delivery-tasks";
import { computeDelivery } from "./delivery-evidence";
import type { PlanTier } from "./entitlements";

const businessIdInput = z.object({ businessId: z.string().uuid() });

export type DeliveryTaskRow = {
  taskKey: string;
  status: DeliveryStatus;
  notes: string;
  completedAt: string | null;
  updatedAt: string;
  isOverride: boolean;
};

/** A checklist step with its resolved status and where that status came from. */
export type ResolvedTask = {
  taskKey: string;
  status: DeliveryStatus;
  source: "auto" | "assisted" | "manual";
  overridden: boolean;
  evidence: string | null;
  notes: string;
  actionLabel: string | null;
};

export type DeliveryBoard = {
  businessId: string;
  name: string;
  planTier: PlanTier;
  createdAt: string;
  contactEmail: string | null;
  tasks: ResolvedTask[];
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
      .select("task_key, status, notes, completed_at, updated_at, is_override")
      .eq("business_id", data.businessId);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      taskKey: r.task_key,
      status: r.status as DeliveryStatus,
      notes: r.notes ?? "",
      completedAt: r.completed_at,
      updatedAt: r.updated_at,
      isOverride: r.is_override,
    }));
  });

type StoredRow = {
  task_key: string;
  status: string;
  notes: string | null;
  is_override: boolean;
};

function resolveTasks(
  stored: StoredRow[],
  delivery: NonNullable<Awaited<ReturnType<typeof computeDelivery>>>,
): ResolvedTask[] {
  const applicable = applicableTasks(delivery.planTier, delivery.features);
  return applicable.map((task) => {
    const row = stored.find((r) => r.task_key === task.key);
    const mode = automationFor(task.key);
    const derived =
      mode.kind === "auto"
        ? (delivery.derived as Record<string, { status: DeliveryStatus; evidence: string }>)[
            task.key
          ]
        : undefined;

    const overridden = Boolean(row?.is_override);
    const status: DeliveryStatus = overridden
      ? (row!.status as DeliveryStatus)
      : (derived?.status ?? (row?.status as DeliveryStatus | undefined) ?? "not_started");

    return {
      taskKey: task.key,
      status,
      source: mode.kind,
      overridden,
      evidence: derived?.evidence ?? null,
      notes: row?.notes ?? "",
      actionLabel: assistedActionFor(task.key)?.label ?? null,
    };
  });
}

/**
 * The full board for one client: derived statuses computed from live account
 * data, merged with any status staff have explicitly set. Staff-only through the
 * RLS policies on client_delivery_tasks and client_provisioning; every read
 * carries the requested business_id.
 */
export const getDeliveryBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessIdInput.parse(input))
  .handler(async ({ data, context }): Promise<DeliveryBoard | null> => {
    const delivery = await computeDelivery(context.supabase, data.businessId);
    if (!delivery) return null;

    const { data: rows, error } = await context.supabase
      .from("client_delivery_tasks")
      .select("task_key, status, notes, is_override")
      .eq("business_id", data.businessId);
    if (error) throw new Error(error.message);

    return {
      businessId: delivery.businessId,
      name: delivery.name,
      planTier: delivery.planTier,
      createdAt: delivery.createdAt,
      contactEmail: delivery.contactEmail,
      tasks: resolveTasks(rows ?? [], delivery),
    };
  });

export type QueueItem = {
  businessId: string;
  businessName: string;
  taskKey: string;
  label: string;
  detail: string;
  owner: string;
  day: number;
  dueDate: string;
  overdue: boolean;
  status: DeliveryStatus;
  source: "auto" | "assisted" | "manual";
  actionLabel: string | null;
};

export type QueueClient = {
  businessId: string;
  businessName: string;
  planTier: PlanTier;
  createdAt: string;
  targetDate: string;
  done: number;
  total: number;
  blocked: number;
  risk: "on_track" | "at_risk" | "overdue" | "complete";
};

export type DeliveryQueue = { clients: QueueClient[]; items: QueueItem[] };

/**
 * One queue of every open step across every active client. Staff-only: the
 * underlying tables are gated by `is_platform_staff()`, and each row is
 * explicitly tagged with its business_id so nothing is ever mixed between
 * tenants in the UI.
 */
export const getDeliveryQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeliveryQueue> => {
    const { data: isStaff } = await context.supabase.rpc("is_platform_staff");
    if (!isStaff) throw new Error("Platform staff only");

    const { data: businesses, error } = await context.supabase
      .from("businesses")
      .select("id")
      .in("lifecycle", ["active", "pending_payment"])
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);

    const clients: QueueClient[] = [];
    const items: QueueItem[] = [];

    for (const b of businesses ?? []) {
      const delivery = await computeDelivery(context.supabase, b.id);
      if (!delivery) continue;

      const { data: rows } = await context.supabase
        .from("client_delivery_tasks")
        .select("task_key, status, notes, is_override")
        .eq("business_id", b.id);

      const resolved = resolveTasks(rows ?? [], delivery);
      const created = new Date(delivery.createdAt).getTime();
      const target = new Date(created + 7 * 86_400_000);
      const done = resolved.filter((t) => t.status === "done").length;
      const blocked = resolved.filter((t) => t.status === "blocked").length;
      const elapsedDays = Math.floor((Date.now() - created) / 86_400_000);

      clients.push({
        businessId: b.id,
        businessName: delivery.name,
        planTier: delivery.planTier,
        createdAt: delivery.createdAt,
        targetDate: target.toISOString(),
        done,
        total: resolved.length,
        blocked,
        risk:
          done === resolved.length
            ? "complete"
            : Date.now() > target.getTime()
              ? "overdue"
              : blocked > 0
                ? "at_risk"
                : "on_track",
      });

      for (const t of resolved) {
        if (t.status === "done") continue;
        const def = ALL_DELIVERY_TASKS.find((d) => d.key === t.taskKey);
        if (!def) continue;
        const due = new Date(created + def.day * 86_400_000);
        items.push({
          businessId: b.id,
          businessName: delivery.name,
          taskKey: t.taskKey,
          label: def.label,
          detail: def.detail,
          owner: def.owner,
          day: def.day,
          dueDate: due.toISOString(),
          overdue: elapsedDays > def.day,
          status: t.status,
          source: t.source,
          actionLabel: t.actionLabel,
        });
      }
    }

    items.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const d = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      return d !== 0 ? d : a.businessName.localeCompare(b.businessName);
    });

    return { clients, items };
  });

const setInput = businessIdInput.extend({
  taskKey: z.string().min(1).max(80),
  status: z.enum(DELIVERY_STATUSES),
  notes: z.string().max(2000).optional(),
});

/**
 * Flip one checklist step. Authorization is the `is_platform_staff()` RLS policy
 * on client_delivery_tasks: a client writing here gets a policy violation.
 * A staff-set status is recorded as an override so derived evidence never
 * silently undoes it.
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
        is_override: true,
        completed_at: data.status === "done" ? new Date().toISOString() : null,
      },
      { onConflict: "business_id,task_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Hand a step back to the automation: the derived status takes over again. */
export const clearDeliveryOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessIdInput.extend({ taskKey: z.string().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("client_delivery_tasks")
      .update({ is_override: false })
      .eq("business_id", data.businessId)
      .eq("task_key", data.taskKey);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const bulkInput = z.object({
  status: z.enum(DELIVERY_STATUSES),
  notes: z.string().max(2000).optional(),
  items: z
    .array(z.object({ businessId: z.string().uuid(), taskKey: z.string().min(1).max(80) }))
    .min(1)
    .max(200),
});

/** Set the same status on many steps, across clients, in one write. */
export const setDeliveryTasksBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bulkInput.parse(input))
  .handler(async ({ data, context }) => {
    const completedAt = data.status === "done" ? new Date().toISOString() : null;
    const { error } = await context.supabase.from("client_delivery_tasks").upsert(
      data.items.map((i) => ({
        business_id: i.businessId,
        task_key: i.taskKey,
        status: data.status,
        notes: data.notes ?? null,
        is_override: true,
        completed_at: completedAt,
      })),
      { onConflict: "business_id,task_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, count: data.items.length };
  });

/**
 * Perform an assisted step: send the templated ask to the client contact and
 * move the step forward. Staff-only, and the recipient is resolved server-side
 * from the business record, never from the caller.
 */
export const runDeliveryAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessIdInput.extend({ taskKey: z.string().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isStaff } = await context.supabase.rpc("is_platform_staff");
    if (!isStaff) throw new Error("Platform staff only");

    const action = assistedActionFor(data.taskKey);
    if (!action) throw new Error("No action for this step");

    const delivery = await computeDelivery(context.supabase, data.businessId);
    if (!delivery) throw new Error("Client not found");
    if (!delivery.contactEmail) throw new Error("No contact email on this account");

    const heading = action.subject.replace("{business}", delivery.name);
    const body = action.body.replace("{business}", delivery.name);

    const { sendTemplateEmail } = await import("./email-templates/send-email");
    const result = await sendTemplateEmail("client-delivery-request", delivery.contactEmail, {
      templateData: { businessName: delivery.name, heading, body },
      replyTo: "support@eraleadgen.com",
    });

    const { error } = await context.supabase.from("client_delivery_tasks").upsert(
      {
        business_id: data.businessId,
        task_key: data.taskKey,
        status: action.resultStatus,
        notes: `Sent to ${delivery.contactEmail} on ${new Date().toLocaleDateString()}`,
        is_override: true,
        completed_at: action.resultStatus === "done" ? new Date().toISOString() : null,
      },
      { onConflict: "business_id,task_key" },
    );
    if (error) throw new Error(error.message);

    return { ok: true, sent: result.sent, to: delivery.contactEmail };
  });
