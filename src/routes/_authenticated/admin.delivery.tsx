import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { DELIVERY_STATUS_LABELS } from "@/lib/delivery-tasks";
import {
  getDeliveryQueue,
  runDeliveryAction,
  setDeliveryTasksBulk,
} from "@/lib/delivery-tasks.functions";

export const Route = createFileRoute("/_authenticated/admin/delivery")({
  head: () => ({
    meta: [
      { title: "Delivery queue | ERA Systems" },
      {
        name: "description",
        content:
          "Every open go-live step across every ERA client, ordered by what is overdue and what is due next.",
      },
      { property: "og:title", content: "Delivery queue | ERA Systems" },
      {
        property: "og:description",
        content: "Cross-client go-live queue for ERA platform staff.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DeliveryQueuePage,
});

const RISK_STYLE: Record<string, string> = {
  complete: "border-[oklch(0.78_0.16_150)]/60 text-[oklch(0.84_0.13_155)]",
  on_track: "border-border/70 text-muted-foreground",
  at_risk: "border-[oklch(0.78_0.15_85)]/60 text-[oklch(0.85_0.12_88)]",
  overdue: "border-destructive/60 text-destructive",
};

const RISK_LABEL: Record<string, string> = {
  complete: "Complete",
  on_track: "On track",
  at_risk: "At risk",
  overdue: "Overdue",
};

type Filter = "work" | "overdue" | "all";

function DeliveryQueuePage() {
  const fetchQueue = useServerFn(getDeliveryQueue);
  const bulkSet = useServerFn(setDeliveryTasksBulk);
  const runAction = useServerFn(runDeliveryAction);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("work");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: hasSession } = useQuery({
    queryKey: ["has-session"],
    queryFn: async () => Boolean((await supabase.auth.getSession()).data.session),
    retry: false,
  });

  const queue = useQuery({
    queryKey: ["delivery-queue"],
    queryFn: () => fetchQueue(),
    enabled: hasSession === true,
    retry: false,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["delivery-queue"] });
    void queryClient.invalidateQueries({ queryKey: ["delivery-board"] });
    setSelected(new Set());
  };

  const bulk = useMutation({
    mutationFn: (items: { businessId: string; taskKey: string }[]) =>
      bulkSet({ data: { status: "done", items } }),
    onSuccess: invalidate,
  });

  const action = useMutation({
    mutationFn: (vars: { businessId: string; taskKey: string }) => runAction({ data: vars }),
    onSuccess: invalidate,
  });

  const items = useMemo(() => {
    const all = queue.data?.items ?? [];
    if (filter === "overdue") return all.filter((i) => i.overdue);
    if (filter === "work") return all.filter((i) => i.source !== "auto");
    return all;
  }, [queue.data, filter]);

  const idOf = (businessId: string, taskKey: string) => `${businessId}:${taskKey}`;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (hasSession === false) {
    return (
      <AppShell title="Delivery" variant="staff">
        <div className="era-card p-6">
          <p className="text-sm text-muted-foreground">Sign in with your ERA staff account.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Delivery" variant="staff">
      <div className="grid gap-6">
        <section className="era-card p-6">
          <h2 className="text-base font-semibold">Clients in delivery</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Progress is computed from live account data. Only steps that need a human appear in the
            queue below.
          </p>

          {queue.isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {(queue.data?.clients ?? []).map((c) => (
                <li key={c.businessId} className="rounded-xl border border-border/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      to="/admin/clients/$businessId"
                      params={{ businessId: c.businessId }}
                      className="text-sm font-semibold text-foreground hover:underline"
                    >
                      {c.businessName}
                    </Link>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${RISK_STYLE[c.risk]}`}
                    >
                      {RISK_LABEL[c.risk]}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {c.done}/{c.total} steps · {c.planTier} · live by{" "}
                    {new Date(c.targetDate).toLocaleDateString()}
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${c.total ? Math.round((c.done / c.total) * 100) : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="era-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Queue</h2>
            <div className="flex flex-wrap items-center gap-2">
              {(["work", "overdue", "all"] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                    filter === f
                      ? "border-primary text-primary"
                      : "border-border/70 text-muted-foreground"
                  }`}
                >
                  {f === "work" ? "Needs me" : f === "overdue" ? "Overdue" : "Everything open"}
                </button>
              ))}
              <button
                type="button"
                disabled={selected.size === 0 || bulk.isPending}
                onClick={() =>
                  bulk.mutate(
                    [...selected].map((id) => {
                      const [businessId, taskKey] = id.split(":");
                      return { businessId: businessId!, taskKey: taskKey! };
                    }),
                  )
                }
                className="rounded-full border border-primary/70 px-3 py-1 text-[11px] font-semibold text-primary disabled:opacity-40"
              >
                Mark {selected.size || ""} done
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nothing waiting on you.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border/50 rounded-xl border border-border/60">
              {items.map((i) => {
                const id = idOf(i.businessId, i.taskKey);
                return (
                  <li key={id} className="grid gap-2 p-4 sm:grid-cols-[auto_minmax(0,1fr)]">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 accent-[oklch(0.72_0.13_170)]"
                      aria-label={`Select ${i.label} for ${i.businessName}`}
                      checked={selected.has(id)}
                      onChange={() => toggle(id)}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/admin/clients/$businessId"
                          params={{ businessId: i.businessId }}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          {i.businessName}
                        </Link>
                        <p className="text-sm font-medium text-foreground">{i.label}</p>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                            i.overdue ? RISK_STYLE["overdue"] : "border-border/70 text-muted-foreground"
                          }`}
                        >
                          {i.overdue ? "Overdue" : `Due ${new Date(i.dueDate).toLocaleDateString()}`}
                        </span>
                        <span className="rounded-full border border-border/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {DELIVERY_STATUS_LABELS[i.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{i.detail}</p>
                      {i.actionLabel && (
                        <button
                          type="button"
                          disabled={action.isPending}
                          onClick={() =>
                            action.mutate({ businessId: i.businessId, taskKey: i.taskKey })
                          }
                          className="mt-2 rounded-full border border-primary/70 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10"
                        >
                          {i.actionLabel}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {(bulk.error || action.error || queue.error) && (
            <p className="mt-4 text-sm text-destructive">
              {((bulk.error ?? action.error ?? queue.error) as Error).message}
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
