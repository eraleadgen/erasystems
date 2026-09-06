import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PortalShell } from "@/components/app/portal-page";
import { formatMoney } from "@/lib/entitlements";
import {
  getCustomerBookings,
  inviteCustomerToPortal,
  listCustomers,
  mergeCustomers,
  saveCustomer,
  type CustomerRow,
} from "@/lib/customers.functions";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers | ERA App" },
      { name: "description", content: "Customer records captured by your ERA system." },
      { property: "og:title", content: "Customers | ERA App" },
      { property: "og:description", content: "Customer records captured by your ERA system." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  return <PortalShell title="Customers" feature="customer_portal">{() => <CustomerList />}</PortalShell>;
}

function CustomerList() {
  const fetchAll = useServerFn(listCustomers);
  const save = useServerFn(saveCustomer);
  const merge = useServerFn(mergeCustomers);
  const invite = useServerFn(inviteCustomerToPortal);
  const queryClient = useQueryClient();

  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<CustomerRow> | null>(null);
  const [mergeFrom, setMergeFrom] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: () => fetchAll(),
    retry: false,
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["customers"] });

  const saveMutation = useMutation({
    mutationFn: (row: Partial<CustomerRow>) =>
      save({
        data: {
          ...(row.id ? { id: row.id } : {}),
          fullName: row.fullName ?? "",
          email: row.email ?? "",
          phone: row.phone ?? "",
          notes: row.notes ?? "",
        },
      }),
    onSuccess: () => {
      setEditing(null);
      refresh();
    },
  });

  const mergeMutation = useMutation({
    mutationFn: (ids: { keepId: string; mergeId: string }) => merge({ data: ids }),
    onSuccess: () => {
      setMergeFrom(null);
      refresh();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (customerId: string) => invite({ data: { customerId } }),
    onSuccess: (result) => {
      setInviteLink(`${window.location.origin}/portal?claim=${encodeURIComponent(result.token)}`);
      refresh();
    },
  });

  const rows = customers.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Everyone who books through your site gets a record here, matched on their email or phone.
        </p>
        <button
          type="button"
          className="era-chip"
          onClick={() => setEditing({ fullName: "", email: "", phone: "", notes: "" })}
        >
          Add customer
        </button>
      </div>

      {inviteLink && (
        <div className="era-card p-5">
          <p className="text-sm font-medium text-foreground">Portal link created</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">{inviteLink}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Send this to your customer. It works once and expires in 14 days.
          </p>
          <button type="button" className="era-chip mt-3" onClick={() => setInviteLink(null)}>
            Done
          </button>
        </div>
      )}

      {editing && (
        <form
          className="era-card space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate(editing);
          }}
        >
          <p className="text-sm font-medium text-foreground">
            {editing.id ? "Edit customer" : "New customer"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Name"
              value={editing.fullName ?? ""}
              onChange={(v) => setEditing({ ...editing, fullName: v })}
              required
            />
            <Field
              label="Email"
              value={editing.email ?? ""}
              onChange={(v) => setEditing({ ...editing, email: v })}
            />
            <Field
              label="Phone"
              value={editing.phone ?? ""}
              onChange={(v) => setEditing({ ...editing, phone: v })}
            />
            <Field
              label="Notes"
              value={editing.notes ?? ""}
              onChange={(v) => setEditing({ ...editing, notes: v })}
            />
          </div>
          {saveMutation.isError && (
            <p className="text-xs text-destructive">{(saveMutation.error as Error).message}</p>
          )}
          <div className="flex gap-2">
            <button type="submit" className="era-chip" disabled={saveMutation.isPending}>
              Save
            </button>
            <button type="button" className="era-chip" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {customers.isLoading ? (
        <div className="era-card p-6">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="era-card p-6">
          <p className="text-sm text-muted-foreground">
            No customers yet. Everyone who books through your site appears here.
          </p>
        </div>
      ) : (
        <div className="era-card overflow-hidden">
          <ul className="divide-y divide-border/60">
            {rows.map((c) => (
              <li key={c.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{c.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact details"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.bookingCount} booking{c.bookingCount === 1 ? "" : "s"} ·{" "}
                      {formatMoney(c.lifetimeCents)} lifetime
                      {c.lastBookingAt
                        ? ` · last ${new Date(c.lastBookingAt).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {c.hasLogin ? (
                      <span className="era-chip">Portal account</span>
                    ) : c.inviteePending ? (
                      <span className="era-chip">Invite sent</span>
                    ) : (
                      <button
                        type="button"
                        className="era-chip"
                        disabled={inviteMutation.isPending}
                        onClick={() => inviteMutation.mutate(c.id)}
                      >
                        Invite to portal
                      </button>
                    )}
                    <button
                      type="button"
                      className="era-chip"
                      onClick={() => setEditing({ ...c })}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="era-chip"
                      onClick={() => setOpenId(openId === c.id ? null : c.id)}
                    >
                      {openId === c.id ? "Hide history" : "History"}
                    </button>
                    {mergeFrom && mergeFrom !== c.id ? (
                      <button
                        type="button"
                        className="era-chip"
                        disabled={mergeMutation.isPending}
                        onClick={() => mergeMutation.mutate({ keepId: c.id, mergeId: mergeFrom })}
                      >
                        Merge into this one
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="era-chip"
                        onClick={() => setMergeFrom(mergeFrom === c.id ? null : c.id)}
                      >
                        {mergeFrom === c.id ? "Cancel merge" : "Merge"}
                      </button>
                    )}
                  </div>
                </div>
                {openId === c.id && <CustomerHistory customerId={c.id} />}
              </li>
            ))}
          </ul>
        </div>
      )}
      {mergeMutation.isError && (
        <p className="text-xs text-destructive">{(mergeMutation.error as Error).message}</p>
      )}
    </div>
  );
}

function CustomerHistory({ customerId }: { customerId: string }) {
  const fetchBookings = useServerFn(getCustomerBookings);
  const history = useQuery({
    queryKey: ["customer-bookings", customerId],
    queryFn: () => fetchBookings({ data: { customerId } }),
    retry: false,
  });

  if (history.isLoading) {
    return <p className="mt-3 text-xs text-muted-foreground">Loading history…</p>;
  }
  const rows = history.data ?? [];
  if (rows.length === 0) {
    return <p className="mt-3 text-xs text-muted-foreground">No bookings on this record yet.</p>;
  }
  return (
    <ul className="era-hairline mt-3 space-y-2 border-t pt-3">
      {rows.map((b) => (
        <li key={b.id} className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">
            {new Date(b.startsAt).toLocaleString()} · {b.status}
            {b.specialistName ? ` · ${b.specialistName}` : ""}
          </span>
          <span className="text-foreground">{formatMoney(b.totalCents)}</span>
        </li>
      ))}
    </ul>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        value={value}
        required={required ?? false}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
