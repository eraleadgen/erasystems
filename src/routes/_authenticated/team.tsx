import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PortalShell } from "@/components/app/portal-page";
import { getPortalWorkspace } from "@/lib/portal.functions";
import {
  deleteSpecialist,
  linkSpecialistLogin,
  listSpecialists,
  saveSpecialist,
  type SpecialistRow,
} from "@/lib/specialists.functions";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team | ERA App" },
      { name: "description", content: "Specialists and staff with access to your ERA workspace." },
      { property: "og:title", content: "Team | ERA App" },
      {
        property: "og:description",
        content: "Specialists and staff with access to your ERA workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  return <PortalShell title="Team" feature="specialist_portal">{() => <TeamManager />}</PortalShell>;
}

type Draft = {
  id?: string;
  displayName: string;
  title: string;
  isActive: boolean;
  serviceIds: string[];
  hours: { weekday: number; startMinute: number; endMinute: number }[];
};

function TeamManager() {
  const fetchSpecialists = useServerFn(listSpecialists);
  const fetchWorkspace = useServerFn(getPortalWorkspace);
  const save = useServerFn(saveSpecialist);
  const remove = useServerFn(deleteSpecialist);
  const link = useServerFn(linkSpecialistLogin);
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<Draft | null>(null);

  const specialists = useQuery({
    queryKey: ["specialists"],
    queryFn: () => fetchSpecialists(),
    retry: false,
  });
  const workspace = useQuery({
    queryKey: ["portal-workspace"],
    queryFn: () => fetchWorkspace(),
    retry: false,
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["specialists"] });

  const saveMutation = useMutation({
    mutationFn: (d: Draft) => save({ data: d }),
    onSuccess: () => {
      setDraft(null);
      refresh();
    },
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: refresh,
  });
  const linkMutation = useMutation({
    mutationFn: (v: { specialistId: string; memberUserId: string | null }) => link({ data: v }),
    onSuccess: refresh,
  });

  const services = workspace.data?.services ?? [];
  const members = workspace.data?.team ?? [];
  const rows = specialists.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Specialists do the work. Assign them jobs from the Bookings tab; each one only ever sees
          their own schedule.
        </p>
        <button
          type="button"
          className="era-chip"
          onClick={() =>
            setDraft({ displayName: "", title: "", isActive: true, serviceIds: [], hours: [] })
          }
        >
          Add specialist
        </button>
      </div>

      {draft && (
        <form
          className="era-card space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate(draft);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block text-xs font-medium text-muted-foreground">Name</span>
              <input
                required
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                value={draft.displayName}
                onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-muted-foreground">Role / title</span>
              <input
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">Services they can perform</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {services.map((s) => {
                const on = draft.serviceIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`era-chip ${on ? "border-primary text-primary" : ""}`}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        serviceIds: on
                          ? draft.serviceIds.filter((x) => x !== s.id)
                          : [...draft.serviceIds, s.id],
                      })
                    }
                  >
                    {s.name}
                  </button>
                );
              })}
              {services.length === 0 && (
                <span className="text-xs text-muted-foreground">Add services first.</span>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">Working hours</p>
            <div className="mt-2 space-y-2">
              {DAYS.map((day, weekday) => {
                const entry = draft.hours.find((h) => h.weekday === weekday);
                return (
                  <div key={day} className="flex items-center gap-3 text-xs">
                    <label className="flex w-24 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(entry)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            hours: e.target.checked
                              ? [...draft.hours, { weekday, startMinute: 540, endMinute: 1020 }]
                              : draft.hours.filter((h) => h.weekday !== weekday),
                          })
                        }
                      />
                      {day}
                    </label>
                    {entry && (
                      <>
                        <TimeInput
                          value={entry.startMinute}
                          onChange={(v) =>
                            setDraft({
                              ...draft,
                              hours: draft.hours.map((h) =>
                                h.weekday === weekday ? { ...h, startMinute: v } : h,
                              ),
                            })
                          }
                        />
                        <span className="text-muted-foreground">to</span>
                        <TimeInput
                          value={entry.endMinute}
                          onChange={(v) =>
                            setDraft({
                              ...draft,
                              hours: draft.hours.map((h) =>
                                h.weekday === weekday ? { ...h, endMinute: v } : h,
                              ),
                            })
                          }
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {saveMutation.isError && (
            <p className="text-xs text-destructive">{(saveMutation.error as Error).message}</p>
          )}
          <div className="flex gap-2">
            <button type="submit" className="era-chip" disabled={saveMutation.isPending}>
              Save specialist
            </button>
            <button type="button" className="era-chip" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="era-card overflow-hidden">
        {specialists.isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            No specialists yet. Add the people who do the work.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((s: SpecialistRow) => (
              <li key={s.id} className="space-y-2 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.title || "Specialist"} · {s.assignedCount} assigned ·{" "}
                      {s.serviceIds.length} service{s.serviceIds.length === 1 ? "" : "s"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.hours.length === 0
                        ? "No hours set"
                        : s.hours
                            .map(
                              (h) =>
                                `${DAYS[h.weekday]} ${fmt(h.startMinute)}–${fmt(h.endMinute)}`,
                            )
                            .join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!s.isActive && <span className="era-chip">Inactive</span>}
                    <button
                      type="button"
                      className="era-chip"
                      onClick={() =>
                        setDraft({
                          id: s.id,
                          displayName: s.displayName,
                          title: s.title ?? "",
                          isActive: s.isActive,
                          serviceIds: s.serviceIds,
                          hours: s.hours.map((h) => ({
                            weekday: h.weekday,
                            startMinute: h.startMinute,
                            endMinute: h.endMinute,
                          })),
                        })
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="era-chip"
                      onClick={() => removeMutation.mutate(s.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <label className="block text-xs text-muted-foreground">
                  Linked login (lets them sign in and see their jobs)
                  <select
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                    value={s.userId ?? ""}
                    onChange={(e) =>
                      linkMutation.mutate({
                        specialistId: s.id,
                        memberUserId: e.target.value || null,
                      })
                    }
                  >
                    <option value="">Not linked</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.userId}>
                        {m.role} · {m.userId.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      {linkMutation.isError && (
        <p className="text-xs text-destructive">{(linkMutation.error as Error).message}</p>
      )}
    </div>
  );
}

function fmt(minute: number) {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
}

function TimeInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="time"
      className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
      value={`${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`}
      onChange={(e) => {
        const [h, m] = e.target.value.split(":").map(Number);
        onChange((h ?? 0) * 60 + (m ?? 0));
      }}
    />
  );
}
