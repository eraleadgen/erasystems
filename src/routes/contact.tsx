import { createFileRoute } from "@tanstack/react-router";

import { MarketingShell } from "@/components/marketing/chrome";
import { DiscoveryForm } from "@/components/marketing/discovery-form";

const TITLE = "Book a discovery call with ERA Systems";
const DESCRIPTION =
  "Tell us about your business and we'll set up a discovery call. It's a conversation, not a demo script, and it's the only route to an ERA account.";

export const Route = createFileRoute("/contact")({
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
      <section className="hero-veil">
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
    </MarketingShell>
  );
}
