import { createFileRoute } from "@tanstack/react-router";

import { MarketingShell, PageHero, Reveal, ClosingCta } from "@/components/marketing/chrome";
import { addons } from "@/components/marketing/content";

const TITLE = "ERA add-ons: Ad Management and Downloadable Apps";
const DESCRIPTION =
  "Ad Management and branded Downloadable Apps are available on any ERA tier, including Basic. Both are quoted per business on a discovery call and never bundled into a plan.";

export const Route = createFileRoute("/addons")({
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
  component: AddonsPage,
});

function AddonsPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Add-ons"
        title="Two add-ons, priced per business"
        lede="Available on any tier, including Basic. They are never included in a plan and never granted by upgrading. The price is quoted for your business on the discovery call."
      />

      <section className="section-deep">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 md:grid-cols-2">
            {addons.map((addon, i) => (
              <Reveal key={addon.name} delay={i * 120}>
                <article className="lift h-full rounded-2xl border border-gold/30 bg-card p-7 text-center lg:text-left">
                  <div className="flex flex-col items-center gap-2 lg:flex-row lg:items-baseline lg:justify-between lg:gap-4">
                    <h2 className="font-display text-lg font-semibold text-foreground">
                      {addon.name}
                    </h2>
                    <span className="shrink-0 text-xs font-semibold uppercase tracking-widest text-gold">
                      Custom pricing
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{addon.body}</p>
                  <p className="mt-5 text-xs text-muted-foreground">Available on any tier</p>
                </article>
              </Reveal>
            ))}
          </div>

        </div>
      </section>

      <section className="section-glow">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="mx-auto max-w-2xl text-center text-sm leading-relaxed text-muted-foreground lg:mx-0 lg:text-left">
            Every app build is scoped on a call before anything is quoted or built, whatever tier
            you&apos;re on.
          </p>
        </div>
      </section>

      <ClosingCta title="Want an add-on quoted for your business?" />
    </MarketingShell>
  );
}
