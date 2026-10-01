import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { listDiscoveryCalls, setDiscoveryStatus, type DiscoveryCall } from "@/lib/agency.functions";
import { formatSlotLabel } from "@/lib/booking";

const TITLE = "Calendar | ERA Systems staff";
const DESCRIPTION = "Scheduled discovery calls booked from the ERA marketing site.";

export const Route = createFileRoute("/_authenticated/admin/calendar")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CalendarAdmin,
  errorComponent: ({ error }) => (
    <AppShell title="Calendar" variant="staff">
      <div className="era-card p-6">
        <p className="text-sm text-destructive">{error instanceof Error ? error.message : String(error)}</p>
      </div>
    </AppShell>
  ),
});

const STATUSES = ["new", "scheduled", "completed", "closed"] as const;

function CalendarAdmin() {
  const fetchCalls = useServerFn(listDiscoveryCalls);
  const saveStatus = useServerFn(setDiscoveryStatus);
  const queryClient = useQueryClient();

  const { data: hasSession } = useQuery({
    queryKey: ["has-session"],
    queryFn: async () => Boolean((await supabase.auth.getSession()).data.session),
    retry: false,
  });

  const callsQuery = useQuery({
    queryKey: ["discovery-calls"],
    queryFn: () => fetchCalls(),
    enabled: hasSession === true,
  });

  const update = useMutation({
    mutationFn: (input: { id: string; status: (typeof STATUSES)[number] }) =>
      saveStatus({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["discovery-calls"] }),
  });

  const calls = callsQuery.data ?? [];
  const now = Date.now();
  const upcoming = calls
    .filter((c) => c.scheduledStart && Date.parse(c.scheduledStart) >= now)
    .sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!));
  const unscheduled = calls.filter((c) => !c.scheduledStart);
  const past = calls
    .filter((c) => c.scheduledStart && Date.parse(c.scheduledStart) < now)
    .sort((a, b) => b.scheduledStart!.localeCompare(a.scheduledStart!));

  function Row({ call }: { call: DiscoveryCall }) {
    return (
      <li className="rounded-md border border-border bg-background/40 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {call.businessName} · {call.fullName}
            </p>
            <p className="text-xs text-muted-foreground">
              {call.scheduledStart
                ? formatSlotLabel(call.scheduledStart)
                : `Requested ${new Date(call.createdAt).toLocaleDateString()}`}
            </p>
            <p className="text-xs text-muted-foreground">
              <a className="underline-offset-2 hover:underline" href={`mailto:${call.email}`}>
                {call.email}
              </a>
              {call.phone ? ` · ${call.phone}` : ""}
              {call.businessType ? ` · ${call.businessType}` : ""}
            </p>
            {call.message && (
              <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                {call.message}
              </p>
            )}
          </div>
          <select
            value={call.status}
            onChange={(e) =>
              update.mutate({ id: call.id, status: e.target.value as (typeof STATUSES)[number] })
            }
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </li>
    );
  }

  function Section({ label, items }: { label: string; items: DiscoveryCall[] }) {
    return (
      <section className="era-card p-6">
        <h2 className="text-sm font-semibold text-foreground">
          {label} <span className="text-muted-foreground">({items.length})</span>
        </h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing here right now.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {items.map((c) => (
              <Row key={c.id} call={c} />
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <AppShell title="Calendar" variant="staff">
      {hasSession === false ? (
        <div className="era-card p-6">
          <p className="text-sm text-muted-foreground">
            Sign in with a staff account to view scheduled discovery calls.
          </p>
        </div>
      ) : (
        <>
          <Section label="Upcoming calls" items={upcoming} />
          <Section label="Awaiting a time" items={unscheduled} />
          <Section label="Past calls" items={past} />
        </>
      )}
    </AppShell>
  );
}
