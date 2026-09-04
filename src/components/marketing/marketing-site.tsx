import { Link } from "@tanstack/react-router";

import { HeroVisual } from "./hero-visual";
import { MarketingShell, Reveal, CtaButton, ClosingCta } from "./chrome";
import { outcomes } from "./content";

const summary = [
  {
    to: "/platform" as const,
    label: "Platform",
    title: "One system instead of six tools",
    body: "Website, AI chat, scheduling, customers, jobs and payments on a single record.",
  },
  {
    to: "/pricing" as const,
    label: "Pricing",
    title: "Three tiers, from $199/mo",
    body: "Every tier includes the whole platform. Higher tiers extend it, they don't unlock the basics.",
  },
  {
    to: "/addons" as const,
    label: "Add-ons",
    title: "Ad Management & Downloadable Apps",
    body: "Available on any tier, quoted per business, never bundled into a plan.",
  },
  {
    to: "/proof" as const,
    label: "Proof",
    title: "VDS runs on ERA Core",
    body: "Our own Metro Atlanta detailing business runs the platform we sell you.",
  },
  {
    to: "/faq" as const,
    label: "FAQ",
    title: "Why there's no sign-up button",
    body: "How invites, onboarding and tier changes actually work.",
  },
];

export function MarketingSite() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="hero-veil relative overflow-hidden border-b border-border">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-14 sm:gap-12 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div className="text-center lg:text-left">
            <Reveal>
              <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                <span className="text-shine-emerald">
                  Bringing home service businesses to a new era of efficiency
                </span>
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground lg:mx-0">
                Your website, schedule, customers, jobs and money on one record instead of six
                disconnected tools. Better back-end systems buy back your week, and the follow-up
                keeps earning while you&apos;re on the job.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
                <CtaButton />
                <Link
                  to="/platform"
                  className="rounded-md border border-gold/40 px-6 py-3 text-sm font-semibold text-gold transition-all hover:-translate-y-0.5 hover:bg-gold/10"
                >
                  See the platform
                </Link>
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

      {/* Outcomes, short form */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-left">
            What it buys you
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {outcomes.map((item, i) => (
              <Reveal key={item.title} delay={i * 80}>
                <article className="lift h-full rounded-2xl border border-border bg-card p-6 text-center lg:text-left">
                  <p className="font-display text-2xl font-semibold text-primary">{item.stat}</p>
                  <h3 className="mt-3 font-display text-base font-semibold text-foreground">
                    {item.title}
                  </h3>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Section map */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-left">
            Read the detail
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {summary.map((card, i) => (
              <Reveal key={card.to} delay={i * 70} className="h-full">
                <Link
                  to={card.to}
                  className="lift group flex h-full flex-col rounded-2xl border border-border bg-card p-6 text-center lg:text-left"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
                    {card.label}
                  </span>
                  <h3 className="mt-3 font-display text-lg font-semibold text-foreground">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
                  <span className="mt-5 text-sm font-medium text-primary group-hover:underline">
                    Read more
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <ClosingCta />
    </MarketingShell>
  );
}
