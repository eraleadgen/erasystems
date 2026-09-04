import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  DELIVERY_PHASES,
  DELIVERY_STATUS_LABELS,
  type DeliveryStatus,
  type DeliveryTask,
} from "@/lib/delivery-tasks";
import {
  clearDeliveryOverride,
  getDeliveryBoard,
  runDeliveryAction,
  setDeliveryTask,
  type ResolvedTask,
} from "@/lib/delivery-tasks.functions";

const STATUS_ORDER: DeliveryStatus[] = ["not_started", "in_progress", "blocked", "done"];

const STATUS_STYLE: Record<DeliveryStatus, string> = {
  not_started: "border-border/70 text-muted-foreground",
  in_progress: "border-[oklch(0.78_0.15_85)]/60 text-[oklch(0.85_0.12_88)]",
  blocked: "border-destructive/60 text-destructive",
  done: "border-[oklch(0.78_0.16_150)]/60 text-[oklch(0.84_0.13_155)]",
};

const SOURCE_LABEL: Record<ResolvedTask["source"], string> = {
  auto: "Automatic",
  assisted: "One click",
  manual: "Manual",
};

function daysBetween(from: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 86_400_000));
}

/**
 * The signing workspace: every required step between a client paying and their
 * system being live. Most steps resolve themselves from account data; staff work
 * only the ones that need judgment. Writes go through the staff-only
 * client_delivery_tasks policy and always carry this business_id.
 */
export function DeliveryWorkspace({
  businessId,
  createdAt,
}: {
  businessId: string;
  planTier?: string;
  createdAt: string;
}) {
  const fetchBoard = useServerFn(getDeliveryBoard);
  const saveTask = useServerFn(setDeliveryTask);
  const clearOverride = useServerFn(clearDeliveryOverride);
  const runAction = useServerFn(runDeliveryAction);
  const queryClient = useQueryClient();
  const [openNotes, setOpenNotes] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(true);

  const board = useQuery({
    queryKey: ["delivery-board", businessId],
    queryFn: () => fetchBoard({ data: { businessId } }),
    retry: false,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["delivery-board", businessId] });
    void queryClient.invalidateQueries({ queryKey: ["delivery-queue"] });
  };

  const mutation = useMutation({
    mutationFn: (vars: { taskKey: string; status: DeliveryStatus; notes?: string }) =>
      saveTask({ data: { businessId, ...vars } }),
    onSuccess: invalidate,
  });

  const releaseMutation = useMutation({
    mutationFn: (taskKey: string) => clearOverride({ data: { businessId, taskKey } }),
    onSuccess: invalidate,
  });

  const actionMutation = useMutation({
    mutationFn: (taskKey: string) => runAction({ data: { businessId, taskKey } }),
    onSuccess: invalidate,
  });

  const tasks = useMemo(() => board.data?.tasks ?? [], [board.data]);
  const stateOf = (key: string) => tasks.find((t) => t.taskKey === key);

  const done = tasks.filter((t) => t.status === "done").length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  const autoDone = tasks.filter((t) => t.source === "auto" && t.status === "done").length;
  const needsStaff = tasks.filter((t) => t.status !== "done" && t.source !== "auto").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const elapsed = daysBetween(createdAt);
  const target = new Date(new Date(createdAt).getTime() + 7 * 86_400_000);

  const visiblePhases = DELIVERY_PHASES.map((phase) => ({
    ...phase,
    tasks: phase.tasks.filter((t) => {
      const state = stateOf(t.key);
      if (!state) return false;
      if (!focusMode) return true;
      return state.status !== "done" && state.source !== "auto";
    }),
  })).filter((p) => p.tasks.length > 0);

  const pending = mutation.isPending || actionMutation.isPending || releaseMutation.isPending;
  const error = (mutation.error ?? actionMutation.error ?? releaseMutation.error) as Error | null;

  return (
    <section className="era-card p-6 lg:col-span-2">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Go-live workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {autoDone} step{autoDone === 1 ? "" : "s"} confirmed automatically from account data.
            {needsStaff > 0
              ? ` ${needsStaff} still need you.`
              : " Nothing is waiting on you right now."}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold text-foreground">
            {done}/{tasks.length}
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

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setFocusMode((v) => !v)}
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
            focusMode ? "border-primary text-primary" : "border-border/70 text-muted-foreground"
          }`}
        >
          {focusMode ? "Focus: work only" : "Focus: off"}
        </button>
        {blocked > 0 && (
          <span className="text-xs font-semibold text-destructive">
            {blocked} step{blocked === 1 ? "" : "s"} blocked
          </span>
        )}
      </div>

      {board.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading checklist…</p>
      ) : visiblePhases.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Every step is either confirmed or handled automatically. Turn focus off to see the full
          checklist.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {visiblePhases.map((phase) => (
            <div key={phase.key}>
              <h3 className="text-sm font-semibold text-foreground">{phase.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{phase.summary}</p>

              <ul className="mt-3 divide-y divide-border/50 rounded-xl border border-border/60">
                {phase.tasks.map((task) => {
                  const state = stateOf(task.key)!;
                  return (
                    <TaskRow
                      key={task.key}
                      task={task}
                      state={state}
                      pending={pending}
                      notesOpen={openNotes === task.key}
                      onToggleNotes={() =>
                        setOpenNotes((k) => (k === task.key ? null : task.key))
                      }
                      onStatus={(status) =>
                        mutation.mutate({ taskKey: task.key, status, notes: state.notes })
                      }
                      onNotes={(notes) =>
                        mutation.mutate({ taskKey: task.key, status: state.status, notes })
                      }
                      onAction={() => actionMutation.mutate(task.key)}
                      onRelease={() => releaseMutation.mutate(task.key)}
                    />
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-destructive">{error.message}</p>}
      {actionMutation.isSuccess && (
        <p className="mt-4 text-sm text-muted-foreground">
          Sent to {actionMutation.data?.to}.
        </p>
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
  onAction,
  onRelease,
}: {
  task: DeliveryTask;
  state: ResolvedTask;
  pending: boolean;
  notesOpen: boolean;
  onToggleNotes: () => void;
  onStatus: (status: DeliveryStatus) => void;
  onNotes: (notes: string) => void;
  onAction: () => void;
  onRelease: () => void;
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
            <span className="rounded-full border border-border/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              {SOURCE_LABEL[state.source]}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{task.detail}</p>

          {state.evidence && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Evidence:</span> {state.evidence}
              {state.overridden ? " (overridden manually)" : ""}
            </p>
          )}

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
            {state.actionLabel && (
              <button
                type="button"
                disabled={pending}
                onClick={onAction}
                className="rounded-full border border-primary/70 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10"
              >
                {state.actionLabel}
              </button>
            )}
            {state.overridden && state.evidence && (
              <button
                type="button"
                disabled={pending}
                onClick={onRelease}
                className="text-[11px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Use automatic
              </button>
            )}
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
