import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getMySiteContent, updateMySiteContent } from "@/lib/tenant-site.functions";
import { emptySiteContent, type TenantSiteContent } from "@/lib/tenant-site";
import { WEEK_DAYS, DAY_LABELS } from "@/lib/onboarding";

const field =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60";

function Labelled({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground">{text}</span>
      {children}
    </label>
  );
}

/** Lets a client edit the words, address, hours and booking settings on their own public site. */
export function SiteContentEditor({ canEdit, enabled }: { canEdit: boolean; enabled: boolean }) {
  const queryClient = useQueryClient();
  const fetchSite = useServerFn(getMySiteContent);
  const save = useServerFn(updateMySiteContent);

  const query = useQuery({
    queryKey: ["my-site-content"],
    queryFn: () => fetchSite(),
    enabled,
    retry: false,
  });

  const [form, setForm] = useState<TenantSiteContent | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.isSuccess && !form) setForm(query.data ?? emptySiteContent());
  }, [query.isSuccess, query.data, form]);

  const mutation = useMutation({
    mutationFn: (values: TenantSiteContent) => save({ data: values }),
    onSuccess: () => {
      setSaved(true);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["my-site-content"] });
    },
    onError: (e: Error) => {
      setSaved(false);
      setError(e.message);
    },
  });

  const set = (patch: Partial<TenantSiteContent>) => {
    setSaved(false);
    setForm((f) => (f ? { ...f, ...patch } : f));
  };

  if (!form) {
    return (
      <div className="era-card p-6">
        <p className="text-sm text-muted-foreground">Loading your website content…</p>
      </div>
    );
  }

  return (
    <form
      className="era-card space-y-5 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(form);
      }}
    >
      <div>
        <h2 className="text-sm font-semibold text-foreground">Your public website</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This is what visitors read on your own web address. Leave the headline or story blank
          and we&apos;ll write a sensible one from your business name and service list.
        </p>
      </div>

      <Labelled text="Headline">
        <input
          className={field}
          disabled={!canEdit}
          value={form.tagline}
          placeholder="One line about what you do"
          onChange={(e) => set({ tagline: e.target.value })}
        />
      </Labelled>

      <Labelled text="Your story">
        <textarea
          className={field}
          rows={5}
          disabled={!canEdit}
          value={form.about}
          onChange={(e) => set({ about: e.target.value })}
        />
      </Labelled>

      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled text="Area you serve">
          <input
            className={field}
            disabled={!canEdit}
            value={form.serviceArea}
            placeholder="Greater Phoenix"
            onChange={(e) => set({ serviceArea: e.target.value })}
          />
        </Labelled>
        <Labelled text="Where the work happens">
          <select
            className={field}
            disabled={!canEdit}
            value={form.serviceLocation}
            onChange={(e) =>
              set({ serviceLocation: e.target.value as TenantSiteContent["serviceLocation"] })
            }
          >
            <option value="at_business">Customers come to us</option>
            <option value="at_customer">We travel to the customer</option>
          </select>
        </Labelled>
        <Labelled text="Street address">
          <input
            className={field}
            disabled={!canEdit}
            value={form.addressLine1}
            onChange={(e) => set({ addressLine1: e.target.value })}
          />
        </Labelled>
        <Labelled text="Suite / unit">
          <input
            className={field}
            disabled={!canEdit}
            value={form.addressLine2}
            onChange={(e) => set({ addressLine2: e.target.value })}
          />
        </Labelled>
        <Labelled text="City">
          <input
            className={field}
            disabled={!canEdit}
            value={form.city}
            onChange={(e) => set({ city: e.target.value })}
          />
        </Labelled>
        <Labelled text="State / region">
          <input
            className={field}
            disabled={!canEdit}
            value={form.region}
            onChange={(e) => set({ region: e.target.value })}
          />
        </Labelled>
        <Labelled text="Postal code">
          <input
            className={field}
            disabled={!canEdit}
            value={form.postalCode}
            onChange={(e) => set({ postalCode: e.target.value })}
          />
        </Labelled>
        <Labelled text="Country">
          <input
            className={field}
            disabled={!canEdit}
            value={form.country}
            onChange={(e) => set({ country: e.target.value })}
          />
        </Labelled>
      </div>

      <fieldset>
        <legend className="text-xs font-medium text-muted-foreground">Opening hours</legend>
        <div className="mt-3 space-y-2">
          {WEEK_DAYS.map((day) => {
            const entry = form.hours[day] ?? { closed: false, open: "09:00", close: "17:00" };
            return (
              <div key={day} className="flex flex-wrap items-center gap-3">
                <span className="w-24 text-sm text-foreground">{DAY_LABELS[day]}</span>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={entry.closed}
                    onChange={(e) =>
                      set({ hours: { ...form.hours, [day]: { ...entry, closed: e.target.checked } } })
                    }
                  />
                  Closed
                </label>
                <input
                  type="time"
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                  disabled={!canEdit || entry.closed}
                  value={entry.open}
                  onChange={(e) =>
                    set({ hours: { ...form.hours, [day]: { ...entry, open: e.target.value } } })
                  }
                />
                <input
                  type="time"
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                  disabled={!canEdit || entry.closed}
                  value={entry.close}
                  onChange={(e) =>
                    set({ hours: { ...form.hours, [day]: { ...entry, close: e.target.value } } })
                  }
                />
              </div>
            );
          })}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          disabled={!canEdit}
          checked={form.bookingEnabled}
          onChange={(e) => set({ bookingEnabled: e.target.checked })}
        />
        Let customers book online from my website
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !mutation.isPending && (
        <p className="text-sm text-muted-foreground">Saved. Your website is up to date.</p>
      )}

      <button
        type="submit"
        disabled={!canEdit || mutation.isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {mutation.isPending ? "Saving…" : "Save website content"}
      </button>
    </form>
  );
}
