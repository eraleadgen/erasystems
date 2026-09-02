import { useEffect, useRef, useState, type ReactNode } from "react";

import logoAsset from "@/assets/era-logo.png.asset.json";
import { DiscoveryForm } from "./discovery-form";

const CTA = "#discovery";

const scattered = [
  "Booking app",
  "CRM spreadsheet",
  "Invoicing tool",
  "Website builder",
  "Email blaster",
  "Text messages",
  "Review requests",
  "Paper schedule",
];

const coreCapabilities = [
  {
    title: "Your website, run by the system",
    body: "The public site, service catalog, and booking flow are part of the platform — not a separate build that drifts out of date.",
  },
  {
    title: "AI chat widget",
    body: "Answers questions and captures the lead on the page instead of losing it to a contact form nobody checks.",
  },
  {
    title: "Core engines",
    body: "Scheduling, jobs, customers, and quotes share one record. Nothing is retyped between tools.",
  },
  {
    title: "Payments",
    body: "Deposits, invoices, and paid jobs settle against the same customer and job record.",
  },
  {
    title: "Admin dashboard",
    body: "One place to see the day, the pipeline, and what money is outstanding.",
  },
  {
    title: "Self-serve domain, email & phone",
    body: "Connect your own domain, sending address, and business number from inside the platform.",
  },
];

const tiers = [
  {
    name: "Basic",
    price: "$199",
    tagline: "The full operating system for a single-location business.",
    features: [
      "Website",
      "AI chat widget",
      "Core engines",
      "Payments",
      "Admin dashboard",
      "Self-serve domain, email & phone setup",
      "Email automations",
    ],
    highlighted: false,
  },
  {
    name: "Growth",
    price: "$499",
    tagline: "Adds portals for the people around the work: customers and staff.",
    inherits: "Everything in Basic, plus:",
    features: ["Customer member portal", "Specialist / employee portal"],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "$1,499",
    tagline: "Voice, SMS, analytics, and a referral network on top of the whole platform.",
    inherits: "Everything in Growth, plus:",
    features: [
      "AI Voice & SMS agent",
      "SMS automations",
      "Advanced analytics",
      "Partner / referral network",
    ],
    highlighted: false,
  },
];

const addons = [
  {
    name: "Ad Management",
    body: "We run and maintain your paid acquisition against the same pipeline the platform tracks, so spend is measured against booked jobs rather than clicks.",
  },
  {
    name: "White-Label Branding",
    body: "The platform presents entirely as your brand — your domain, your marks, your customer-facing surfaces, with ERA out of the way.",
  },
];

const steps = [
  {
    title: "Discovery call",
    body: "We look at what you run today and whether ERA is actually a fit. If it isn't, we say so.",
  },
  {
    title: "Invite & guided setup",
    body: "If it is, we send you a private invite link. That's the only way an account gets created here — there is no public sign-up. You then walk through a guided setup: business details, branding, services and pricing, your team.",
  },
  {
    title: "Go live",
    body: "Your tier and any add-ons are set from the call, you complete payment, and the platform goes live on your domain.",
  },
];

const faqs = [
  {
    q: "Why can't I just sign up?",
    a: "Because setup isn't self-explanatory and a half-configured operating system is worse than the patchwork it replaced. Accounts are created by invite after a discovery call, so every business that goes live has been walked through it.",
  },
  {
    q: "What happens on the discovery call?",
    a: "We go through the tools you're running now, what breaks between them, and what your week actually looks like. You leave knowing the tier, the add-ons if any, and the real number.",
  },
  {
    q: "Are add-ons tied to a tier?",
    a: "No. Ad Management and White-Label Branding are available on any tier, including Basic, and are never bundled into a higher plan. They're quoted per business.",
  },
  {
    q: "Can I change tiers later?",
    a: "Yes. Tiers are set by us from the discovery call and can be changed as the business changes — nothing about your data is tied to the plan you started on.",
  },
  {
    q: "Who is ERA for?",
    a: "Local service businesses — trades, home services, mobile services, appointment-based shops — that are running six disconnected tools and a spreadsheet.",
  },
  {
    q: "What do I need to bring?",
    a: "Your service list and pricing, your domain if you already have one, and a rough idea of who on your team needs access.",
  },
];

function Logo({ className = "h-9" }: { className?: string }) {
  return <img src={logoAsset.url} alt="ERA Systems" className={`${className} w-auto`} />;
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-visible={visible}
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal ${className}`}
    >
      {children}
    </div>
  );
}

function HeroVisual() {
  const nodes = ["Website", "Chat", "Scheduling", "Customers", "Jobs", "Payments"];
  return (
    <div className="relative flex h-[22rem] items-center justify-center sm:h-[26rem]">
      <div className="animate-pulse-ring absolute size-64 rounded-full bg-primary/20 blur-3xl sm:size-80" />
      <div className="absolute size-56 rounded-full border border-primary/25 sm:size-72" />
      <div className="absolute size-72 rounded-full border border-gold/20 sm:size-[22rem]" />

      <div className="animate-orbit absolute size-56 sm:size-72">
        {nodes.map((label, i) => {
          const angle = (360 / nodes.length) * i;
          return (
            <span
              key={label}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ transform: `rotate(${angle}deg) translateY(-9rem) rotate(-${angle}deg)` }}
            >
              <span
                className="animate-orbit block rounded-full border border-metal/60 bg-card/90 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-elevated backdrop-blur"
                style={{ animationDirection: "reverse" }}
              >
                {label}
              </span>
            </span>
          );
        })}
      </div>

      <div className="animate-float glow-ring relative rounded-2xl border border-primary/30 bg-card/85 px-7 py-6 text-center backdrop-blur">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-gold">ERA Core</p>
        <p className="mt-2 font-display text-2xl font-semibold text-foreground">One record</p>
        <p className="mt-1 text-xs text-muted-foreground">Everything writes here</p>
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="mt-0.5 size-4 shrink-0 text-primary"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden
    >
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MarketingSite() {
  return (
    <div className="dark min-h-screen bg-background font-body text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#platform" className="hover:text-foreground">
              Platform
            </a>
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
            <a href="#addons" className="hover:text-foreground">
              Add-ons
            </a>
            <a href="#faq" className="hover:text-foreground">
              FAQ
            </a>
          </nav>
          <a
            href={CTA}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-elevated transition-all hover:-translate-y-0.5 hover:bg-primary/90"
          >
            Book a discovery call
          </a>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-hero">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
            <div>
              <Reveal>
                <p className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
                  ERA Core
                </p>
              </Reveal>
              <Reveal delay={80}>
                <h1 className="text-gradient-emerald mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                  One operating system for the whole business.
                </h1>
              </Reveal>
              <Reveal delay={160}>
                <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
                  Most local service businesses run on a patchwork: a booking app, a CRM nobody
                  updates, an invoicing tool, a website someone built once, an email blaster, a
                  phone, and a spreadsheet holding it together. ERA Core replaces the patchwork with
                  a single system where the site, the schedule, the customer, the job, and the money
                  are all the same record.
                </p>
              </Reveal>
              <Reveal delay={240}>
                <div className="mt-9 flex flex-wrap items-center gap-4">
                  <a
                    href={CTA}
                    className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elevated transition-all hover:-translate-y-0.5 hover:bg-primary/90"
                  >
                    Book a discovery call
                  </a>
                  <a
                    href="#pricing"
                    className="rounded-md border border-gold/40 px-6 py-3 text-sm font-semibold text-gold transition-all hover:-translate-y-0.5 hover:bg-gold/10"
                  >
                    See the three tiers
                  </a>
                </div>
                <p className="mt-5 text-xs text-muted-foreground">
                  No sign-up form. Every ERA account starts with a conversation.
                </p>
              </Reveal>
            </div>

            <Reveal delay={200} className="flex items-center justify-center">
              <HeroVisual />
            </Reveal>
          </div>
        </section>

        {/* Patchwork problem */}
        <section id="platform" className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              The patchwork costs more than the software
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Every tool holds a slightly different version of the truth, and someone on your team
              spends their day being the integration between them.
            </p>

            <div className="mt-10 grid items-stretch gap-6 lg:grid-cols-[1fr_auto_1fr]">
              <Reveal className="rounded-2xl border border-dashed border-border bg-muted/40 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Today
                </p>
                <ul className="mt-5 flex flex-wrap gap-2.5">
                  {scattered.map((tool, i) => (
                    <li
                      key={tool}
                      className="animate-float rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-foreground"
                      style={{
                        transform: `rotate(${(i % 3) - 1}deg)`,
                        animationDelay: `${i * 320}ms`,
                      }}
                    >
                      {tool}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
                  Eight logins, no shared record, and re-entry between every one of them.
                </p>
              </Reveal>

              <div className="flex items-center justify-center text-2xl text-gold">
                <span aria-hidden className="animate-pulse-ring">
                  →
                </span>
              </div>

              <Reveal
                delay={140}
                className="glow-ring rounded-2xl border border-primary/40 bg-primary p-6 text-primary-foreground"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
                  With ERA Core
                </p>
                <p className="mt-5 font-display text-2xl font-semibold">One system of record</p>
                <p className="mt-3 text-sm leading-relaxed text-primary-foreground/85">
                  Site, chat, scheduling, customers, jobs, quotes, payments, and automations share
                  the same data. A booking made on your site is the same object your invoice, your
                  reminder, and your dashboard are looking at.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* What ERA Core is */}
        <section className="border-b border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              What ERA Core is
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Every tier includes the platform itself. Higher tiers extend it; they don&apos;t
              unlock the basics.
            </p>
            <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {coreCapabilities.map((cap) => (
                <article key={cap.title} className="bg-card p-6">
                  <h3 className="font-display text-base font-semibold text-foreground">
                    {cap.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{cap.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              Three tiers
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Your tier is set with you on the discovery call, not picked from a checkout page.
            </p>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {tiers.map((tier) => (
                <article
                  key={tier.name}
                  className={`flex flex-col rounded-2xl border p-7 ${
                    tier.highlighted
                      ? "border-primary bg-card shadow-elevated"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-xl font-semibold text-foreground">
                      {tier.name}
                    </h3>
                    {tier.highlighted && (
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
                        Common starting point
                      </span>
                    )}
                  </div>
                  <p className="mt-4 font-display text-4xl font-semibold text-foreground">
                    {tier.price}
                    <span className="ml-1 text-sm font-medium text-muted-foreground">/mo</span>
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {tier.tagline}
                  </p>

                  {tier.inherits && (
                    <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {tier.inherits}
                    </p>
                  )}
                  <ul className={`${tier.inherits ? "mt-3" : "mt-6"} grid gap-2.5`}>
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex gap-2.5 text-sm text-foreground">
                        <Check />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href={CTA}
                    className={`mt-8 rounded-md px-4 py-2.5 text-center text-sm font-semibold transition-colors ${
                      tier.highlighted
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border border-metal text-foreground hover:bg-muted"
                    }`}
                  >
                    Book a discovery call
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Add-ons */}
        <section id="addons" className="border-b border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              Two add-ons, priced per business
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Available on any tier, including Basic. They are never included in a plan and never
              granted by upgrading — the price is quoted for your business on the discovery call.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {addons.map((addon) => (
                <article key={addon.name} className="rounded-2xl border border-metal bg-card p-7">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="font-display text-lg font-semibold text-foreground">
                      {addon.name}
                    </h3>
                    <span className="shrink-0 text-xs font-semibold uppercase tracking-widest text-primary">
                      Custom pricing
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{addon.body}</p>
                  <p className="mt-5 text-xs text-muted-foreground">Available on any tier</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              How you get started
            </h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {steps.map((step, i) => (
                <li key={step.title} className="rounded-2xl border border-border bg-card p-7">
                  <span className="font-display text-sm font-semibold text-primary">
                    0{i + 1}
                  </span>
                  <h3 className="mt-3 font-display text-lg font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Honest status */}
        <section className="border-b border-border bg-primary text-primary-foreground">
          <div className="mx-auto max-w-4xl px-6 py-14 text-center">
            <p className="font-display text-xl font-semibold">
              ERA is a new platform, and we&apos;re not going to pretend otherwise.
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-primary-foreground/85">
              You won&apos;t find customer logos, testimonials, or client counts on this page,
              because we haven&apos;t earned them yet. What we&apos;ll do on a discovery call is
              show you the actual product and tell you honestly whether it fits your business.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-b border-border">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              Questions
            </h2>
            <dl className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card">
              {faqs.map((item) => (
                <div key={item.q} className="p-6">
                  <dt className="font-display text-base font-semibold text-foreground">{item.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Contact */}
        <section id="discovery" className="bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                Book a discovery call
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                Tell us a little about the business and we&apos;ll get back to you to set up a time.
                It&apos;s a conversation, not a demo script — and it&apos;s the only route to an ERA
                account.
              </p>
              <p className="mt-6 text-sm text-muted-foreground">
                Prefer email?{" "}
                <a
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  href="mailto:support@eraleadgen.com"
                >
                  support@eraleadgen.com
                </a>
              </p>
            </div>
            <DiscoveryForm />
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <Logo className="h-8" />
          <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
            <a href="#platform" className="hover:text-foreground">
              Platform
            </a>
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
            <a href="#faq" className="hover:text-foreground">
              FAQ
            </a>
            <a href="mailto:support@eraleadgen.com" className="hover:text-foreground">
              support@eraleadgen.com
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} ERA Systems LLC
          </p>
        </div>
      </footer>
    </div>
  );
}
