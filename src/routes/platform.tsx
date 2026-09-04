import { createFileRoute } from "@tanstack/react-router";

import { MarketingShell, PageHero, Reveal, ClosingCta } from "@/components/marketing/chrome";
import { coreCapabilities, outcomes, steps } from "@/components/marketing/content";

const TITLE = "The ERA Core platform for local service businesses";
const DESCRIPTION =
  "Website, AI chat widget, scheduling, customers, jobs and payments on one record. See what ERA Core does day to day and how onboarding works.";

export const Route = createFileRoute("/platform")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlatformPage,
});

function PlatformPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Platform"
        title="Better back-end systems buy you time, and time is where the revenue is"
        lede="Most local service businesses run on a patchwork: a booking app, a CRM nobody updates, an invoicing tool, a website someone built once, an email blaster, a phone, and a spreadsheet holding it together. ERA Core replaces the patchwork with a single system where the site, the schedule, the customer, the job, and the money are all the same record."
      />

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {outcomes.map((item, i) => (
              <Reveal key={item.title} delay={i * 80}>
                <article className="lift h-full rounded-2xl border border-border bg-card p-7">
                  <p className="font-display text-3xl font-semibold text-primary">{item.stat}</p>
                  <h2 className="mt-3 font-display text-base font-semibold text-foreground">
                    {item.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </article>
              </Reveal>
            ))}
          </div>

          <Reveal
            delay={140}
            className="glow-ring mt-12 rounded-2xl border border-primary/40 bg-primary p-7 text-primary-foreground"
          >
            <p className="font-display text-xl font-semibold">Revenue on autopilot</p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-primary-foreground/85">
              A lead lands at 11pm and the chat widget answers it. The quote goes out, the reminder
              fires, the deposit clears, the job closes, the review request sends, and the customer
              gets pulled back in months later, without anyone remembering to do any of it.
              That&apos;s the difference between a business you run and a business that runs.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            What that looks like day to day
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Every tier includes the whole platform. Higher tiers extend it; they don&apos;t unlock
            the basics.
          </p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {coreCapabilities.map((cap, i) => (
              <Reveal key={cap.title} delay={i * 70}>
                <article className="group h-full bg-card p-6 transition-colors hover:bg-card/60">
                  <span className="block h-0.5 w-8 rounded-full bg-gold transition-all duration-500 group-hover:w-16" />
                  <h3 className="mt-4 font-display text-base font-semibold text-foreground">
                    {cap.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{cap.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            How you get started
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title}>
                <Reveal delay={i * 130}>
                  <div className="lift h-full rounded-2xl border border-border bg-card p-7">
                    <span className="inline-flex size-9 items-center justify-center rounded-full border border-gold/40 font-display text-sm font-semibold text-gold">
                      0{i + 1}
                    </span>
                    <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <ClosingCta />
    </MarketingShell>
  );
}
