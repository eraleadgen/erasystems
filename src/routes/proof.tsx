import { createFileRoute, notFound } from "@tanstack/react-router";

import { getHostContext } from "@/lib/host-context.functions";

import { MarketingShell, PageHero, Reveal, ClosingCta } from "@/components/marketing/chrome";
import vdsHero from "@/assets/vds-hero.png.asset.json";
import vdsAbout from "@/assets/vds-about.png.asset.json";

const TITLE = "Proof: Valet Detailing Service runs on ERA Core";
const DESCRIPTION =
  "VDS is our own Metro Atlanta mobile detailing business, and its website, quoting, booking, customer records and payments all run on ERA Core.";

export const Route = createFileRoute("/proof")({
  // ERA-only page: never served on a client's own domain.
  loader: async () => {
    if ((await getHostContext()).tenantAttached) throw notFound();
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
  component: ProofPage,
});

function ProofPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="Proof it works"
        title="Valet Detailing Service runs on ERA Core"
        lede="VDS is a mobile detailing business in Metro Atlanta, and it's ours. We built ERA because we were running it on the same patchwork everyone else is. Its website, quoting, booking, customer records, and payments all run on the platform we're selling you, which means we feel every rough edge before you do."
      />

      <section className="section-glow">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 lg:grid-cols-2">
            <Reveal className="overflow-hidden rounded-2xl border border-metal/60 bg-card">
              <img
                src={vdsHero.url}
                alt="Valet Detailing Service homepage, built and run on ERA Core"
                loading="lazy"
                className="w-full"
              />
            </Reveal>
            <Reveal
              delay={120}
              className="overflow-hidden rounded-2xl border border-metal/60 bg-card"
            >
              <img
                src={vdsAbout.url}
                alt="Valet Detailing Service service pages running on the ERA Core platform"
                loading="lazy"
                className="w-full"
              />
            </Reveal>
          </div>

          <Reveal
            delay={160}
            className="mt-10 rounded-2xl border border-primary/40 bg-primary p-7 text-center text-primary-foreground lg:text-left"
          >
            <p className="font-display text-lg font-semibold">One real business, honestly stated.</p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-primary-foreground/85">
              ERA is new. VDS is the business proving it in the field, and we own it, so we
              aren&apos;t calling it an independent case study. You won&apos;t find borrowed logos
              or invented testimonials here. On a discovery call we&apos;ll walk you through the
              live VDS build, back office included, and tell you plainly whether ERA fits you.
            </p>
          </Reveal>
        </div>
      </section>

      <ClosingCta title="Want a walkthrough of the live build?" />
    </MarketingShell>
  );
}
