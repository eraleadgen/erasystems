import { createFileRoute } from "@tanstack/react-router";

import { MarketingShell, PageHero, Reveal, ClosingCta } from "@/components/marketing/chrome";
import { faqs } from "@/components/marketing/content";

const TITLE = "ERA Systems FAQ: invites, tiers and add-ons";
const DESCRIPTION =
  "Why there is no public sign-up, what happens on a discovery call, whether add-ons are tied to a tier, how tier changes work, and who ERA Core is built for.";

export const Route = createFileRoute("/faq")({
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
          "@type": "FAQPage",
          mainEntity: faqs.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }),
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="FAQ"
        title="Questions"
        lede="The things prospects ask before a discovery call, answered plainly."
      />

      <section className="section-glow">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <dl className="divide-y divide-border rounded-2xl border border-border bg-card">
            {faqs.map((item, i) => (
              <Reveal key={item.q} delay={i * 60}>
                <div className="p-6 text-center transition-colors hover:bg-muted/40 lg:text-left">
                  <dt className="font-display text-base font-semibold text-foreground">{item.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      <ClosingCta title="Still have a question?" />
    </MarketingShell>
  );
}
