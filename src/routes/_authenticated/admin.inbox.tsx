import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";

import { AppShell } from "@/components/app/app-shell";
import { formatMoney } from "@/lib/entitlements";
import { updateClientBilling } from "@/lib/clients.functions";
import {
  listOnboardingInbox,
  saveOnboardingInboxItem,
  setInboxReviewed,
  type InboxItem,
} from "@/lib/inbox.functions";

export const Route = createFileRoute("/_authenticated/admin/inbox")({
  validateSearch: z.object({ id: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Onboarding inbox | ERA Systems" },
      { name: "description", content: "New client onboarding submissions with their full business setup." },
      { property: "og:title", content: "Onboarding inbox | ERA Systems" },
      { property: "og:description", content: "Review and edit each new client's onboarding answers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: InboxPage,
});

const input = "mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground";

function InboxPage() {
  const { id } = Route.useSearch();
  const fetchInbox = useServerFn(listOnboardingInbox);
  const inbox = useQuery({ queryKey: ["onboarding-inbox"], queryFn: () => fetchInbox(), retry: false });
  const [selected, setSelected] = useState<string | null>(id ?? null);
  const items = inbox.data ?? [];
  const current = items.find((i) => i.draftId === selected) ?? items[0] ?? null;
  const unread = items.filter((i) => !i.reviewedAt).length;

  return (
    <AppShell title="Onboarding inbox" variant="staff" role="Platform staff">
      <p className="text-sm text-muted-foreground">
        Every finished onboarding form lands here. {unread} new.
      </p>
      {inbox.isLoading ? (
        <div className="era-card p-6 text-sm text-muted-foreground">Loading…</div>
      ) : inbox.error ? (
        <div className="era-card p-6 text-sm text-destructive">{(inbox.error as Error).message}</div>
      ) : items.length === 0 ? (
        <div className="era-card p-6 text-sm text-muted-foreground">No submissions yet.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <ul className="era-card divide-y divide-border/50 overflow-hidden">
            {items.map((i) => (
              <li key={i.draftId}>
                <button
                  type="button"
                  onClick={() => setSelected(i.draftId)}
                  className={`w-full px-4 py-3 text-left text-sm hover:bg-muted ${current?.draftId === i.draftId ? "bg-muted" : ""}`}
                >
                  <span className="flex items-center gap-2">
                    {!i.reviewedAt && <span className="size-2 rounded-full bg-primary" aria-label="New" />}
                    <span className={`truncate ${i.reviewedAt ? "" : "font-semibold"}`}>{i.business?.name ?? "Unnamed"}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {new Date(i.submittedAt).toLocaleDateString()} · {i.planTier ?? "basic"} · {i.lifecycle?.replace("_", " ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {current && <InboxDetail key={current.draftId} item={current} />}
        </div>
      )}
    </AppShell>
  );
}

function InboxDetail({ item }: { item: InboxItem }) {
  const save = useServerFn(saveOnboardingInboxItem);
  const mark = useServerFn(setInboxReviewed);
  const qc = useQueryClient();
  const [business, setBusiness] = useState(item.business);
  const [site, setSite] = useState(item.site);
  const [services, setServices] = useState(item.services);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!item.reviewedAt) {
      void mark({ data: { draftId: item.draftId, reviewed: true } }).then(() =>
        qc.invalidateQueries({ queryKey: ["onboarding-inbox"] }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.draftId]);

  const saveM = useMutation({
    mutationFn: () =>
      save({
        data: {
          draftId: item.draftId,
          businessId: item.businessId!,
          business: business!,
          site: site ?? { addressLine1: "", addressLine2: "", city: "", region: "", postalCode: "", country: "" },
          services,
        },
      }),
    onSuccess: () => {
      setMsg("Saved. The client's live setup is updated.");
      void qc.invalidateQueries({ queryKey: ["onboarding-inbox"] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const answers = item.answers as {
    basics?: Record<string, unknown>;
    team?: { members?: { fullName: string; email: string; title?: string }[] };
    integrations?: Record<string, unknown>;
  };
  const hours = (answers.basics?.["hours"] ?? {}) as Record<string, { closed: boolean; open: string; close: string }>;

  if (!business || !item.businessId) {
    return <div className="era-card p-6 text-sm text-muted-foreground">This submission has no business yet.</div>;
  }

  const field = (label: string, value: string, onChange: (v: string) => void, type = "text") => (
    <label className="text-xs text-muted-foreground">
      {label}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={input} />
    </label>
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        saveM.mutate();
      }}
    >
      <section className="era-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {item.logoUrl ? (
            <div className="mb-3 flex items-center gap-3">
              <img src={item.logoUrl} alt={`${business.name} logo`} className="h-14 w-auto max-w-[10rem] rounded border border-border bg-background object-contain p-1" />
              <a href={item.logoUrl} download target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                Download logo
              </a>
            </div>
          ) : (
            <p className="mb-3 text-xs text-muted-foreground">No logo uploaded.</p>
          )}
          <h2 className="text-base font-semibold">{business.name}</h2>
          <Link to="/admin/clients/$businessId" params={{ businessId: item.businessId }} className="text-xs text-primary underline">
            Open client page
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {field("Business name", business.name, (v) => setBusiness({ ...business, name: v }))}
          {field("Legal name", business.legalName, (v) => setBusiness({ ...business, legalName: v }))}
          {field("Email", business.supportEmail, (v) => setBusiness({ ...business, supportEmail: v }))}
          {field("Phone", business.supportPhone, (v) => setBusiness({ ...business, supportPhone: v }))}
          {field("Timezone", business.timezone, (v) => setBusiness({ ...business, timezone: v }))}
          <p className="text-xs text-muted-foreground">
            EIN<span className="mt-1 block text-sm text-foreground">{String(answers.basics?.["ein"] || "Not given")}</span>
          </p>
          {field("Brand color", business.brandPrimary || "#0f766e", (v) => setBusiness({ ...business, brandPrimary: v }), "color")}
          {field("Accent color", business.brandAccent || "#94a3b8", (v) => setBusiness({ ...business, brandAccent: v }), "color")}
        </div>
      </section>

      <BillingSection item={item} />

      {site && (
        <section className="era-card p-5">
          <h3 className="text-sm font-semibold">Address</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {field("Address line 1", site.addressLine1, (v) => setSite({ ...site, addressLine1: v }))}
            {field("Address line 2", site.addressLine2, (v) => setSite({ ...site, addressLine2: v }))}
            {field("City", site.city, (v) => setSite({ ...site, city: v }))}
            {field("State", site.region, (v) => setSite({ ...site, region: v }))}
            {field("ZIP", site.postalCode, (v) => setSite({ ...site, postalCode: v }))}
            {field("Country", site.country, (v) => setSite({ ...site, country: v }))}
          </div>
        </section>
      )}

      <section className="era-card p-5">
        <h3 className="text-sm font-semibold">Services</h3>
        {services.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No services entered.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {services.map((s, idx) => (
              <div key={s.id} className="grid gap-2 sm:grid-cols-[1fr_8rem_7rem]">
                <input
                  aria-label="Service name"
                  value={s.name}
                  onChange={(e) => setServices(services.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
                  className={input}
                />
                <input
                  aria-label="Price (USD)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={s.priceCents / 100}
                  onChange={(e) =>
                    setServices(services.map((x, i) => (i === idx ? { ...x, priceCents: Math.round(Number(e.target.value || 0) * 100) } : x)))
                  }
                  className={input}
                />
                <input
                  aria-label="Minutes"
                  type="number"
                  min="5"
                  value={s.durationMinutes}
                  onChange={(e) =>
                    setServices(services.map((x, i) => (i === idx ? { ...x, durationMinutes: Number(e.target.value || 0) } : x)))
                  }
                  className={input}
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Price in USD ({services.map((s) => formatMoney(s.priceCents)).join(", ")}) · length in minutes</p>
          </div>
        )}
      </section>

      <section className="era-card p-5 text-sm">
        <h3 className="text-sm font-semibold">Other answers</h3>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Hours</dt>
            <dd>
              {Object.entries(hours).map(([d, h]) => (
                <span key={d} className="block">
                  {d}: {h.closed ? "Closed" : `${h.open}–${h.close}`}
                </span>
              ))}
            </dd>
          </div>
          {Object.entries(answers.integrations ?? {}).map(([k, v]) =>
            v ? (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{k.replace(/([A-Z])/g, " $1").toLowerCase()}</dt>
                <dd>{String(v)}</dd>
              </div>
            ) : null,
          )}
          {(answers.team?.members ?? []).length > 0 && (
            <div>
              <dt className="text-xs text-muted-foreground">Team</dt>
              <dd>
                {answers.team!.members!.map((m) => (
                  <span key={m.email} className="block">
                    {m.fullName} · {m.email}
                    {m.title ? ` · ${m.title}` : ""}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saveM.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {saveM.isPending ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() =>
            void mark({ data: { draftId: item.draftId, reviewed: false } }).then(() =>
              qc.invalidateQueries({ queryKey: ["onboarding-inbox"] }),
            )
          }
          className="rounded-md border border-border px-3 py-2 text-xs"
        >
          Mark as new
        </button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </form>
  );
}

const INTERVALS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Yearly" },
  { value: "one_time", label: "One time" },
] as const;

/** The invite quote checkout charges. Saved through the same staff-only billing update as the client page. */
function BillingSection({ item }: { item: InboxItem }) {
  const update = useServerFn(updateClientBilling);
  const qc = useQueryClient();
  const b = item.billing;
  const [tier, setTier] = useState(b?.planTier ?? "basic");
  const [interval, setBillingInt] = useState(b?.billingInterval ?? "monthly");
  const [recurring, setRecurring] = useState(b ? String(b.subscriptionPriceCents / 100) : "");
  const [setup, setSetup] = useState(b ? String(b.setupFeeCents / 100) : "");
  const [msg, setMsg] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () =>
      update({
        data: {
          businessId: item.businessId!,
          planTier: tier as "basic" | "growth" | "enterprise",
          billingInterval: interval as "monthly" | "quarterly" | "annual" | "one_time",
          subscriptionPriceCents: Math.round(Number(recurring || 0) * 100),
          setupFeeCents: Math.round(Number(setup || 0) * 100),
        },
      }),
    onSuccess: (r) => {
      setMsg(
        r.stripeUpdated
          ? "Saved. Stripe will charge the new amount from the next billing date."
          : "Saved. Checkout will charge these amounts.",
      );
      void qc.invalidateQueries({ queryKey: ["onboarding-inbox"] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  if (!b) {
    return (
      <section className="era-card p-5">
        <h3 className="text-sm font-semibold">Plan and quote</h3>
        <p className="mt-2 text-sm text-muted-foreground">This client has no invitation quote on file.</p>
      </section>
    );
  }

  return (
    <section className="era-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Plan and quote</h3>
        <p className="text-xs text-muted-foreground">
          Current: {b.planTier} · {formatMoney(b.subscriptionPriceCents)}{" "}
          {INTERVALS.find((i) => i.value === b.billingInterval)?.label.toLowerCase()} · setup {formatMoney(b.setupFeeCents)}
        </p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          Plan
          <select value={tier} onChange={(e) => setTier(e.target.value)} className={input}>
            <option value="basic">Basic</option>
            <option value="growth">Growth</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Billing schedule
          <select value={interval} onChange={(e) => setBillingInt(e.target.value)} className={input}>
            {INTERVALS.map((i) => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Recurring price (USD)
          <input type="number" min="0" step="0.01" value={recurring} onChange={(e) => setRecurring(e.target.value)} className={input} />
        </label>
        <label className="text-xs text-muted-foreground">
          One-time setup fee (USD)
          <input type="number" min="0" step="0.01" value={setup} onChange={(e) => setSetup(e.target.value)} className={input} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={m.isPending}
          onClick={() => {
            setMsg(null);
            m.mutate();
          }}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
        >
          {m.isPending ? "Saving…" : "Save plan and quote"}
        </button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
    </section>
  );
}
