import { createFileRoute, notFound } from "@tanstack/react-router";

import { isTenantHost } from "@/lib/host-context.functions";

import { MarketingShell } from "@/components/marketing/chrome";
import { DiscoveryForm } from "@/components/marketing/discovery-form";

const TITLE = "Book a discovery call with ERA Systems";
const DESCRIPTION =
  "Tell us about your business and we'll set up a discovery call. It's a conversation, not a demo script, and it's the only route to an ERA account.";

export const Route = createFileRoute("/contact")({
  // ERA-only page: never served on a client\'s own domain.
  loader: async () => {
    if (await isTenantHost()) throw notFound();
  },
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
  component: ContactPage,
});

function ContactPage() {
  return (
    <MarketingShell>
      <section className="section-deep">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">Contact</p>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-foreground">
              Book a discovery call
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              Tell us a little about the business and we&apos;ll get back to you to set up a time.
              It&apos;s a conversation, not a demo script, and it&apos;s the only route to an ERA
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

      <section className="section-glow">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-center font-display text-2xl font-semibold text-foreground lg:text-left">
            What happens next
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              { t: "We reply", b: "You hear back from support@eraleadgen.com to confirm the time that works." },
              { t: "We talk", b: "A 60 minute call about what you run today, what breaks, and whether ERA fits." },
              { t: "We scope", b: "If it fits, we set the tier and any add-ons with you, then send an invite." },
            ].map((s, i) => (
              <article key={s.t} className="lift h-full rounded-2xl border border-border bg-card p-6 text-center lg:text-left">
                <span className="inline-flex size-9 items-center justify-center rounded-full border border-gold/40 font-display text-sm font-semibold text-gold">
                  0{i + 1}
                </span>
                <h3 className="mt-4 font-display text-base font-semibold text-foreground">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.b}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
