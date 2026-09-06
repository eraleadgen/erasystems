import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PortalShell } from "@/components/app/portal-page";
import { formatMoney } from "@/lib/entitlements";
import { getPortalWorkspace } from "@/lib/portal.functions";
import { assignBookingSpecialist, listSpecialists } from "@/lib/specialists.functions";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({
    meta: [
      { title: "Bookings | ERA App" },
      { name: "description", content: "Every booking captured by your ERA system." },
      { property: "og:title", content: "Bookings | ERA App" },
      { property: "og:description", content: "Every booking captured by your ERA system." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BookingsPage,
});

function BookingsPage() {
  return <PortalShell title="Bookings" feature="core_engines">{() => <BookingList />}</PortalShell>;
}

function BookingList() {
  const fetchWorkspace = useServerFn(getPortalWorkspace);
  const fetchSpecialists = useServerFn(listSpecialists);
  const assign = useServerFn(assignBookingSpecialist);
  const queryClient = useQueryClient();

  const workspace = useQuery({
    queryKey: ["portal-workspace"],
    queryFn: () => fetchWorkspace(),
    retry: false,
  });
  const specialists = useQuery({
    queryKey: ["specialists"],
    queryFn: () => fetchSpecialists(),
    retry: false,
  });

  const assignMutation = useMutation({
    mutationFn: (v: { bookingId: string; specialistId: string | null }) => assign({ data: v }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["portal-workspace"] }),
  });

  const bookings = workspace.data?.bookings ?? [];
  const people = specialists.data ?? [];

  if (workspace.isLoading) {
    return (
      <div className="era-card p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="era-card p-6">
        <p className="text-sm text-muted-foreground">
          No bookings yet. New enquiries land here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="era-card overflow-hidden">
      <ul className="divide-y divide-border/60">
        {bookings.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{b.customerName}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(b.startsAt).toLocaleString()} · {b.status}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {people.length > 0 && (
                <select
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
                  value={b.specialistId ?? ""}
                  onChange={(e) =>
                    assignMutation.mutate({
                      bookingId: b.id,
                      specialistId: e.target.value || null,
                    })
                  }
                >
                  <option value="">Unassigned</option>
                  {people.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName}
                    </option>
                  ))}
                </select>
              )}
              <span className="shrink-0 text-sm text-foreground">{formatMoney(b.totalCents)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
