import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import type { AddonKind, PlanTier } from "@/lib/entitlements";
import {
  DELIVERY_PHASES,
  DELIVERY_STATUS_LABELS,
  applicableTasks,
  type DeliveryStatus,
  type DeliveryTask,
} from "@/lib/delivery-tasks";
import { getDeliveryTasks, setDeliveryTask } from "@/lib/delivery-tasks.functions";
import { getBusinessAddons, getMyEntitlements } from "@/lib/entitlements.functions";

const STATUS_ORDER: DeliveryStatus[] = ["not_started", "in_progress", "blocked", "done"];

const STATUS_STYLE: Record<DeliveryStatus, string> = {
  not_started: "border-border/70 text-muted-foreground",
  in_progress: "border-[oklch(0.78_0.15_85)]/60 text-[oklch(0.85_0.12_88)]",
  blocked: "border-destructive/60 text-destructive",
  done: "border-[oklch(0.78_0.16_150)]/60 text-[oklch(0.84_0.13_155)]",
};

function daysBetween(from: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 86_400_000));
}

/**
 * The signing workspace: every required step between a client paying and their
 * system being live, checked off by staff. Writes go through the staff-only
 * client_delivery_tasks policy and always carry this business_id.
 */
export function DeliveryWorkspace({
  businessId,
  planTier,
  createdAt,
}: {
  businessId: string;
  planTier: PlanTier;
  createdAt: string;
}) {
  const fetchEntitlements = useServerFn(getMyEntitlements);
  const fetchAddons = useServerFn(getBusinessAddons);
  const fetchTasks = useServerFn(getDeliveryTasks);
  const saveTask = useServerFn(setDeliveryTask);
  const queryClient = useQueryClient();
  const [openNotes, setOpenNotes] = useState<string | null>(null);

  const entitlements = useQuery({
    queryKey: ["client-entitlements", businessId],
    queryFn: () => fetchEntitlements({ data: { businessId } }),
    retry: false,
  });
  const addons = useQuery({
    queryKey: ["client-addons", businessId],
    queryFn: () => fetchAddons({ data: { businessId } }),
    retry: false,
  });
  const tasks = useQuery({
    queryKey: ["delivery-tasks", businessId],
    queryFn: () => fetchTasks({ data: { businessId } }),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (vars: { taskKey: string; status: DeliveryStatus; notes?: string }) =>
      saveTask({ data: { businessId, ...vars } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["delivery-tasks", businessId] });
    },
  });

  const activeAddons = (addons.data ?? [])
    .filter((a) => a.isActive)
    .map((a) => a.addon as AddonKind);

  const applicable = useMemo(
    () => applicableTasks(planTier, entitlements.data?.features ?? [], activeAddons),
    [planTier, entitlements.data?.features, activeAddons.join(",")],
  );

  const rows = tasks.data ?? [];
  const stateOf = (key: string) =>
    rows.find((r) => r.taskKey === key) ?? {
      taskKey: key,
      status: "not_started" as DeliveryStatus,
      notes: "",
      completedAt: null,
      updatedAt: "",
    };

  const done = applicable.filter((t) => stateOf(t.key).status === "done").length;
  const blocked = applicable.filter((t) => stateOf(t.key).status === "blocked").length;
  const pct = applicable.length ? Math.round((done / applicable.length) * 100) : 0;
  const elapsed = daysBetween(createdAt);
  const target = new Date(new Date(createdAt).getTime() + 7 * 86_400_000);

  const visiblePhases = DELIVERY_PHASES.map((phase) => ({
    ...phase,
    tasks: phase.tasks.filter((t) => applicable.some((a) => a.key === t.key)),
  })).filter((p) => p.tasks.length > 0);

  return (
    <section className="era-card p-6 lg:col-span-2">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Go-live workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every required step from payment to a fully automated system, inside the 7 day window.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold text-foreground">
            {done}/{applicable.length}
          </p>
          <p className="text-xs text-muted-foreground">
            Day {elapsed} of 7 · target {target.toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {blocked > 0 && (
        <p className="mt-2 text-xs font-semibold text-destructive">
          {blocked} step{blocked === 1 ? "" : "s"} blocked
        </p>
      )}

      {tasks.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading checklist…</p>
      ) : (
        <div className="mt-6 space-y-6">
          {visiblePhases.map((phase) => {
            const phaseDone = phase.tasks.filter((t) => stateOf(t.key).status === "done").length;
            return (
              <div key={phase.key}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
                  <h3 className="text-sm font-semibold text-foreground">{phase.title}</h3>
                  <span className="text-xs text-muted-foreground">
                    {phaseDone}/{phase.tasks.length}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{phase.summary}</p>

                <ul className="mt-3 divide-y divide-border/50 rounded-xl border border-border/60">
                  {phase.tasks.map((task) => (
                    <TaskRow
                      key={task.key}
                      task={task}
                      state={stateOf(task.key)}
                      pending={mutation.isPending}
                      notesOpen={openNotes === task.key}
                      onToggleNotes={() =>
                        setOpenNotes((k) => (k === task.key ? null : task.key))
                      }
                      onStatus={(status) =>
                        mutation.mutate({ taskKey: task.key, status, notes: stateOf(task.key).notes })
                      }
                      onNotes={(notes) =>
                        mutation.mutate({
                          taskKey: task.key,
                          status: stateOf(task.key).status,
                          notes,
                        })
                      }
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {mutation.isError && (
        <p className="mt-4 text-sm text-destructive">{(mutation.error as Error).message}</p>
      )}
    </section>
  );
}

function TaskRow({
  task,
  state,
  pending,
  notesOpen,
  onToggleNotes,
  onStatus,
  onNotes,
}: {
  task: DeliveryTask;
  state: { status: DeliveryStatus; notes: string; completedAt: string | null };
  pending: boolean;
  notesOpen: boolean;
  onToggleNotes: () => void;
  onStatus: (status: DeliveryStatus) => void;
  onNotes: (notes: string) => void;
}) {
  const isDone = state.status === "done";
  return (
    <li className="p-4">
      <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
        <button
          type="button"
          aria-label={isDone ? `Reopen ${task.label}` : `Mark ${task.label} done`}
          disabled={pending}
          onClick={() => onStatus(isDone ? "not_started" : "done")}
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold transition-colors ${
            isDone
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border/80 text-transparent hover:border-primary"
          }`}
        >
          ✓
        </button>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`text-sm font-medium ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}
            >
              {task.label}
            </p>
            <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {task.owner === "era" ? "ERA" : "Client"} · day {task.day}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{task.detail}</p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                disabled={pending}
                onClick={() => onStatus(s)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  state.status === s
                    ? STATUS_STYLE[s]
                    : "border-transparent text-muted-foreground hover:border-border/70"
                }`}
              >
                {DELIVERY_STATUS_LABELS[s]}
              </button>
            ))}
            <button
              type="button"
              onClick={onToggleNotes}
              className="text-[11px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {state.notes ? "Notes ●" : "Notes"}
            </button>
          </div>

          {notesOpen && (
            <textarea
              className="mt-2 w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              rows={2}
              defaultValue={state.notes}
              placeholder="Blocker, ticket number, who owes what"
              onBlur={(e) => {
                if (e.target.value !== state.notes) onNotes(e.target.value);
              }}
            />
          )}
        </div>
      </div>
    </li>
  );
}
