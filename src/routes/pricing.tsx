import { createFileRoute } from "@tanstack/react-router";

import {
  MarketingShell,
  PageHero,
  Reveal,
  Check,
  CtaButton,
  ClosingCta,
} from "@/components/marketing/chrome";
import { tiers } from "@/components/marketing/content";

const TITLE = "ERA Core pricing: Basic, Growth and Enterprise tiers";
const DESCRIPTION =
  "Three ERA Core tiers from $199/mo. Every tier includes the full platform; Growth adds portals and Enterprise adds voice, SMS, analytics and the partner network.";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "ERA Core",
          description: DESCRIPTION,
          offers: [
            { "@type": "Offer", name: "Basic", price: "199", priceCurrency: "USD" },
            { "@type": "Offer", name: "Growth", price: "499", priceCurrency: "USD" },
            { "@type": "Offer", name: "Enterprise", price: "1499", priceCurrency: "USD" },
          ],
        }),
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Pricing"
        title="Three tiers"
        lede="Your tier is set with you on the discovery call, not picked from a checkout page. Every tier includes the whole platform; higher tiers extend it rather than unlocking the basics."
      />

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 lg:grid-cols-3">
            {tiers.map((tier, i) => (
              <Reveal key={tier.name} delay={i * 110} className="h-full">
                <article
                  className={`lift flex h-full flex-col rounded-2xl border p-7 ${
                    tier.highlighted
                      ? "glow-ring border-primary/60 bg-card"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
                    <h2 className="font-display text-xl font-semibold text-foreground">
                      {tier.name}
                    </h2>
                    {tier.highlighted && (
                      <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-gold">
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

                  <div className="mt-8 flex">
                    <CtaButton
                      className={`w-full rounded-md px-4 py-2.5 text-center text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                        tier.highlighted
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "border border-metal text-foreground hover:border-gold/50 hover:text-gold"
                      }`}
                    />
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <ClosingCta title="Not sure which tier fits?" />
    </MarketingShell>
  );
}
