import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import logo from "@/assets/vds-logo.png.asset.json";
import type { ResolvedTenant } from "@/lib/tenant.functions";
import type { TenantService } from "@/components/tenant-home";
import { requestTenantBooking } from "@/lib/tenant-booking.functions";
import {
import { TenantChatWidget } from "@/components/tenant/chat-widget";
  VDS_EMAIL,
  VDS_FAQ,
  VDS_GOLD,
  VDS_PHONE_DISPLAY,
  VDS_PHONE_E164,
  VDS_PILLARS,
  VDS_REVIEWS,
  VDS_STATS,
  VEHICLE_CONDITIONS,
  type ConditionId,
} from "@/lib/vds-content";

const NAV = [
  { href: "#services", label: "Services" },
  { href: "#book", label: "Quote & book" },
  { href: "#gold", label: "VDS Gold" },
  { href: "#reviews", label: "Reviews" },
  { href: "#faq", label: "FAQ" },
];

function money(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-[0.42em] text-primary sm:text-xs">{children}</p>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <a href="#top" className="flex items-center">
          <img src={logo.url} alt="VDS Mobile" className="h-6 w-auto sm:h-7" />
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground transition-colors hover:text-primary"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 md:hidden"
        >
          <span className="block h-px w-6 bg-foreground" />
          <span className="block h-px w-6 bg-foreground" />
          <span className="block h-px w-6 bg-foreground" />
        </button>
      </div>
      {open && (
        <nav className="border-t border-border px-5 py-4 md:hidden">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block py-3 text-center text-[11px] uppercase tracking-[0.3em] text-muted-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="vds-hero relative overflow-hidden">
      <div className="relative mx-auto max-w-6xl px-5 py-20 text-center sm:px-8 sm:py-28">
        <Kicker>Valet Detailing Service</Kicker>
        <p className="mt-3 text-[11px] uppercase tracking-[0.34em] text-muted-foreground">
          Metro Atlanta · Mobile detailing
        </p>
        <h1 className="mx-auto mt-8 max-w-3xl text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
          THE RITUAL
          <br />
          OF <span className="text-primary">REFLECTION.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
          Premium mobile detailing for luxury and performance vehicles across Metro Atlanta. We come
          to you, no shop visit required.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="#book" className="vds-btn-primary w-full sm:w-auto">
            Get a quote
          </a>
          <a href="#book" className="vds-btn w-full sm:w-auto">
            Book now
          </a>
        </div>
        <a href="#gold" className="vds-btn-gold mx-auto mt-4 inline-flex">
          ◆ Explore VDS Gold
        </a>

        <dl className="mt-16 grid grid-cols-2 gap-y-10 border-t border-border pt-12 sm:grid-cols-4">
          {VDS_STATS.map((stat) => (
            <div key={stat.label}>
              <dt className="text-3xl font-bold text-primary sm:text-4xl">{stat.value}</dt>
              <dd className="mt-2 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Reviews() {
  return (
    <section id="reviews" className="border-t border-border px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Kicker>Real results · Real clients</Kicker>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Google reviews <span className="text-primary">★★★★★</span>
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {VDS_REVIEWS.slice(0, 3).map((review) => (
            <figure key={review.name} className="vds-card p-6">
              <span className="text-2xl leading-none text-primary/70">&ldquo;</span>
              <p className="mt-1 text-primary">★★★★★</p>
              <blockquote className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {review.quote}
              </blockquote>
              <figcaption className="mt-6 flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">{review.name}</span>
                <span className="uppercase tracking-[0.2em] text-muted-foreground">via Google</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Services({ services }: { services: TenantService[] }) {
  return (
    <section id="services" className="vds-band border-t border-border px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Kicker>What we offer</Kicker>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Our services</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Professional grade detailing for luxury and performance vehicles. Every service uses
            professional products and paint safe techniques perfected over four years.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {VDS_PILLARS.map((pillar) => (
            <article key={pillar.code} className="vds-card flex flex-col p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {pillar.code}
              </p>
              <h3 className="mt-3 text-xl font-bold uppercase tracking-tight">{pillar.title}</h3>
              <p className="mt-1 text-sm text-primary">{pillar.sub}</p>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                // Technical stack
              </p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {pillar.stack.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-primary">◆</span>
                    {line}
                  </li>
                ))}
              </ul>
              <a href="#book" className="vds-btn mt-8 justify-center">
                Book now
              </a>
            </article>
          ))}
        </div>

        {services.length > 0 && (
          <div className="mt-14">
            <h3 className="text-center text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              Menu and pricing
            </h3>
            <ul className="mx-auto mt-6 max-w-3xl divide-y divide-border border-y border-border">
              {services.map((service) => (
                <li key={service.id} className="flex items-baseline justify-between gap-6 py-4">
                  <div>
                    <p className="font-semibold">{service.name}</p>
                    {service.description && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {service.description}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-primary">
                      {service.base_price_cents === 0 ? "Free" : money(service.base_price_cents)}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {service.duration_minutes} min
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function Gold() {
  return (
    <section id="gold" className="border-t border-border px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <Kicker>Introducing</Kicker>
          <h2 className="mt-4 text-5xl font-extrabold tracking-tight text-primary sm:text-6xl">
            VDS GOLD
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            The premium monthly membership that keeps your vehicle in a permanent state of
            perfection. Unlimited exterior details, one interior detail per month and ceramic
            sealant with every detail.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-10">
            <p className="text-2xl font-bold">
              {VDS_GOLD.priceSedan}{" "}
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                sedan / coupe
              </span>
            </p>
            <p className="text-2xl font-bold">
              {VDS_GOLD.priceTruck}{" "}
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                truck / SUV
              </span>
            </p>
          </div>
          <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            Per vehicle / month · vs {VDS_GOLD.retail} retail value
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="vds-card p-6">
            <p className="text-[10px] uppercase tracking-[0.28em] text-primary">Exterior detail</p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Unlimited / month
            </p>
            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              {VDS_GOLD.exterior.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-primary">◆</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="vds-card p-6">
            <p className="text-[10px] uppercase tracking-[0.28em] text-primary">Interior detail</p>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              1× per month
            </p>
            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              {VDS_GOLD.interior.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-primary">◆</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {VDS_GOLD.steps.map((step) => (
            <div key={step.n} className="vds-card p-6">
              <p className="font-mono text-2xl font-bold text-primary">{step.n}</p>
              <h3 className="mt-3 text-sm font-bold uppercase tracking-[0.16em]">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <a href={`sms:${VDS_PHONE_E164}`} className="vds-btn-primary inline-flex">
            Join the circle
          </a>
          <p className="mt-3 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            No contracts · Cancel anytime · Metro Atlanta
          </p>
        </div>
      </div>
    </section>
  );
}

function QuoteAndBook({
  businessId,
  services,
}: {
  businessId: string;
  services: TenantService[];
}) {
  const submit = useServerFn(requestTenantBooking);
  const [selected, setSelected] = useState<string[]>([]);
  const [condition, setCondition] = useState<ConditionId>("light");
  const [form, setForm] = useState({
    vehicle: "",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    address: "",
    notes: "",
    date: "",
    time: "10:00",
  });
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const multiplier =
    VEHICLE_CONDITIONS.find((c) => c.id === condition)?.multiplier ?? 1;

  const quote = useMemo(() => {
    const chosen = services.filter((s) => selected.includes(s.id));
    const cents = chosen.reduce((sum, s) => sum + s.base_price_cents, 0);
    const minutes = chosen.reduce((sum, s) => sum + s.duration_minutes, 0);
    return { cents: Math.round(cents * multiplier), minutes, chosen };
  }, [services, selected, multiplier]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (selected.length === 0) {
      setError("Choose at least one service.");
      return;
    }
    setState("sending");
    try {
      await submit({
        data: {
          businessId,
          serviceIds: selected,
          conditionMultiplier: multiplier,
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          customerEmail: form.customerEmail,
          vehicle: form.vehicle,
          address: form.address,
          notes: form.notes,
          startsAt: new Date(`${form.date}T${form.time}:00`).toISOString(),
        },
      });
      setState("done");
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Something went wrong, please text us.");
    }
  }

  if (state === "done") {
    return (
      <section id="book" className="vds-band border-t border-border px-5 py-20 sm:px-8">
        <div className="vds-card mx-auto max-w-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-primary">Request received</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Thanks {form.customerName.split(" ")[0]}. We will text {form.customerPhone} shortly to
            confirm your appointment and the final amount.
          </p>
        </div>
      </section>
    );
  }

  const detailing = services.filter((s) => s.base_price_cents >= 10000);
  const addons = services.filter((s) => s.base_price_cents > 0 && s.base_price_cents < 10000);
  const consults = services.filter((s) => s.base_price_cents === 0);

  const group = (title: string, list: TenantService[]) =>
    list.length > 0 && (
      <div className="mt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {title}
        </p>
        <div className="mt-3 space-y-3">
          {list.map((service) => {
            const on = selected.includes(service.id);
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => toggle(service.id)}
                aria-pressed={on}
                className={`flex w-full items-center justify-between gap-4 border px-4 py-4 text-left transition-colors ${
                  on ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`flex h-5 w-5 items-center justify-center border text-[11px] ${
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground"
                    }`}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className="text-sm">{service.name}</span>
                </span>
                <span className="shrink-0 font-bold text-primary">
                  {service.base_price_cents === 0 ? "Free" : money(service.base_price_cents)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );

  const field =
    "mt-2 w-full border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";
  const label = "text-[11px] uppercase tracking-[0.24em] text-muted-foreground";

  return (
    <section id="book" className="vds-band border-t border-border px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <Kicker>Metro Atlanta · Mobile detailing</Kicker>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight text-primary sm:text-5xl">
            QUOTE &amp; BOOK
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Build your custom quote and schedule in one place. Pricing adjusts to your vehicle
            condition and add-ons.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-12 space-y-10">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">
              1 · Your vehicle
            </p>
            <label className="mt-4 block">
              <span className={label}>Year, make and model</span>
              <input
                className={field}
                placeholder="2027 Cadillac Escalade"
                value={form.vehicle}
                onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
              />
            </label>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">
              2 · Vehicle condition
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {VEHICLE_CONDITIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCondition(c.id)}
                  className={`border px-4 py-4 text-left transition-colors ${
                    condition === c.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <span className="block text-sm font-semibold">{c.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{c.note}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">
              3 · Choose your services
            </p>
            {group("Detailing services", detailing)}
            {group("Add-on services", addons)}
            {group("Consultations", consults)}
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">
              4 · Schedule
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={label}>Preferred date</span>
                <input
                  type="date"
                  required
                  className={field}
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>
              <label className="block">
                <span className={label}>Preferred time</span>
                <input
                  type="time"
                  required
                  className={field}
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">
              5 · Your details
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={label}>Name</span>
                <input
                  required
                  className={field}
                  placeholder="John Smith"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                />
              </label>
              <label className="block">
                <span className={label}>Phone / text</span>
                <input
                  required
                  className={field}
                  placeholder="(404) 555-0000"
                  value={form.customerPhone}
                  onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className={label}>Email</span>
                <input
                  type="email"
                  className={field}
                  placeholder="you@email.com"
                  value={form.customerEmail}
                  onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className={label}>Service address</span>
                <input
                  required
                  className={field}
                  placeholder="123 Main St, Atlanta GA"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className={label}>Notes</span>
                <textarea
                  rows={3}
                  className={field}
                  placeholder="Any special requests..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="vds-card p-6">
            <p className="text-[11px] uppercase tracking-[0.24em] text-primary">
              ✦ Your custom quote
            </p>
            {quote.chosen.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Choose your services above to see pricing.
              </p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {quote.chosen.map((s) => (
                  <li key={s.id} className="flex justify-between">
                    <span>{s.name}</span>
                    <span className="text-primary">
                      {s.base_price_cents === 0 ? "Quoted on site" : money(s.base_price_cents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex items-end justify-between border-t border-border pt-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Custom quote
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Est. {Math.floor(quote.minutes / 60)}h {quote.minutes % 60}m
                </p>
              </div>
              <p className="text-4xl font-extrabold text-primary">{money(quote.cents)}</p>
            </div>
            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={state === "sending"}
              className="vds-btn-primary mt-6 w-full justify-center disabled:opacity-60"
            >
              {state === "sending" ? "Sending..." : "Confirm booking →"}
            </button>
            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              Custom quote based on size, condition and add-ons. Final amount confirmed before
              service.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="border-t border-border px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <Kicker>Still not sure?</Kicker>
          <h2 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            FREQUENTLY ASKED
          </h2>
        </div>
        {VDS_FAQ.map((group) => (
          <div key={group.group} className="mt-10">
            <p className="text-[11px] uppercase tracking-[0.28em] text-primary">{group.group}</p>
            <div className="mt-4 divide-y divide-border border-y border-border">
              {group.items.map((item) => (
                <details key={item.q} className="group py-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold marker:hidden">
                    {item.q}
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        ))}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            Still have questions? Reach out by call or text.
          </p>
          <a href={`tel:${VDS_PHONE_E164}`} className="vds-btn-primary mt-5 inline-flex">
            Call / text {VDS_PHONE_DISPLAY}
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border px-5 py-14 sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <img src={logo.url} alt="VDS Mobile" className="h-6 w-auto" />
          <p className="mt-5 text-sm text-muted-foreground">
            Valet Detailing Service LLC
            <br />
            Metro Atlanta, GA
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Navigate</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="hover:text-primary">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Contact</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              <a href={`tel:${VDS_PHONE_E164}`} className="hover:text-primary">
                Call / text {VDS_PHONE_DISPLAY}
              </a>
            </li>
            <li>
              <a href={`mailto:${VDS_EMAIL}`} className="break-all hover:text-primary">
                {VDS_EMAIL}
              </a>
            </li>
          </ul>
          <a href="#gold" className="vds-btn-gold mt-6 inline-flex">
            ◆ Join VDS Gold
          </a>
        </div>
      </div>
      <p className="mx-auto mt-12 max-w-6xl text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        © {new Date().getFullYear()} Valet Detailing Service LLC. All rights reserved.
      </p>
    </footer>
  );
}

/** The public VDS Mobile marketing site, rendered on the VDS tenant hostname. */
export function VdsSite({
  tenant,
  services,
}: {
  tenant: ResolvedTenant;
  services: TenantService[];
}) {
  return (
    <div className="vds-site min-h-screen bg-background font-mono text-foreground">
      <Header />
      <main>
        <Hero />
        <Reviews />
        <Services services={services} />
        <Gold />
        <QuoteAndBook businessId={tenant.businessId} services={services} />
        <Faq />
      </main>
      <Footer />
      <TenantChatWidget
        businessId={tenant.businessId}
        businessName={tenant.name}
        primary={tenant.brandPrimary || "#d4af37"}
        accent={tenant.brandAccent || undefined}
      />
      <a
        href={`sms:${VDS_PHONE_E164}`}
        aria-label="Text VDS Mobile"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_30px_rgba(212,175,55,0.45)]"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 11.5a8.38 8.38 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.38 8.38 0 0 1 4 11.5a8.5 8.5 0 0 1 17 0Z" />
        </svg>
      </a>
    </div>
  );
}
