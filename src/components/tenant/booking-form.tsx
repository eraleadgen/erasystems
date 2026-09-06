import { useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";

import { requestTenantBooking } from "@/lib/tenant-booking.functions";
import type { TenantService } from "@/components/tenant-home";

/**
 * Industry-neutral booking form used by every tenant site.
 *
 * Nothing here knows what the business sells: services, prices and durations
 * all come from that tenant's own catalog, and the amount is recomputed
 * server-side. Trade-specific extras (a vehicle field, a condition multiplier)
 * are passed in by a variant, never baked in as the default.
 */

export type BookingExtras = {
  /** Multiplier applied server-side on top of the catalog subtotal. */
  multiplier: number;
  /** Free-text detail appended to the booking notes. */
  subject?: string;
  /** Extra controls rendered above the contact fields. */
  children?: ReactNode;
};

function money(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export function useBookingSelection(services: TenantService[]) {
  const [selected, setSelected] = useState<string[]>([]);
  const chosen = useMemo(
    () => services.filter((service) => selected.includes(service.id)),
    [services, selected],
  );
  const subtotal = chosen.reduce((sum, s) => sum + s.base_price_cents, 0);
  const minutes = chosen.reduce((sum, s) => sum + s.duration_minutes, 0);
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  return { selected, chosen, subtotal, minutes, toggle };
}

export function TenantBookingForm({
  businessId,
  services,
  requireAddress,
  extras,
  accent,
  inputClassName,
  labelClassName,
}: {
  businessId: string;
  services: TenantService[];
  requireAddress: boolean;
  extras?: BookingExtras;
  accent?: string | undefined;
  inputClassName?: string;
  labelClassName?: string;
}) {
  const submit = useServerFn(requestTenantBooking);
  const { selected, subtotal, minutes, toggle } = useBookingSelection(services);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ totalCents: number; minutes: number } | null>(null);

  const multiplier = extras?.multiplier ?? 1;
  const estimate = Math.round(subtotal * multiplier);

  const input =
    inputClassName ??
    "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
  const label = labelClassName ?? "block text-xs font-medium text-muted-foreground";

  if (status === "done" && confirmed) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground">Booking request received</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;ve got your request for {confirmed.minutes} minutes of work, estimated at{" "}
          {money(confirmed.totalCents)}. You&apos;ll get a confirmation shortly.
        </p>
      </div>
    );
  }

  return (
    <form
      className="rounded-lg border border-border bg-card p-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        if (selected.length === 0) {
          setError("Choose at least one service.");
          return;
        }
        if (!startsAt) {
          setError("Choose a date and time.");
          return;
        }
        setStatus("sending");
        try {
          const result = await submit({
            data: {
              businessId,
              serviceIds: selected,
              conditionMultiplier: multiplier,
              customerName: name,
              customerPhone: phone,
              customerEmail: email,
              vehicle: extras?.subject ?? "",
              address,
              notes,
              startsAt: new Date(startsAt).toISOString(),
            },
          });
          setConfirmed({ totalCents: result.totalCents, minutes: result.minutes });
          setStatus("done");
        } catch (e) {
          setStatus("idle");
          setError(e instanceof Error ? e.message : "Could not send your request.");
        }
      }}
    >
      <fieldset>
        <legend className="text-sm font-semibold text-foreground">What do you need?</legend>
        <ul className="mt-3 space-y-2">
          {services.map((service) => (
            <li key={service.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border px-4 py-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(service.id)}
                  onChange={() => toggle(service.id)}
                />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-foreground">{service.name}</span>
                  {service.description && (
                    <span className="block text-xs text-muted-foreground">
                      {service.description}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold text-foreground">
                    {money(service.base_price_cents)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {service.duration_minutes} min
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {extras?.children}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Your name</span>
          <input
            className={input}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={label}>Phone</span>
          <input
            className={input}
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={label}>Email (optional)</span>
          <input
            className={input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={label}>Preferred date &amp; time</span>
          <input
            className={input}
            type="datetime-local"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </label>
        {requireAddress && (
          <label className="block sm:col-span-2">
            <span className={label}>Service address</span>
            <input
              className={input}
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
        )}
        <label className="block sm:col-span-2">
          <span className={label}>Anything we should know? (optional)</span>
          <textarea
            className={input}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Estimate</p>
          <p className="text-2xl font-semibold text-foreground">{money(estimate)}</p>
          <p className="text-xs text-muted-foreground">
            {minutes > 0 ? `About ${minutes} minutes` : "Select services to see a price"}
          </p>
        </div>
        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded-md px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: accent ?? "hsl(var(--primary))" }}
        >
          {status === "sending" ? "Sending…" : "Request booking"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </form>
  );
}
