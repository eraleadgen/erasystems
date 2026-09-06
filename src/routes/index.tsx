import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";

import { resolveTenant, getTenantServices } from "@/lib/tenant.functions";
import { getTenantSite } from "@/lib/tenant-site.functions";
import { emptySiteContent } from "@/lib/tenant-site";
import { getHostContext } from "@/lib/host-context.functions";
import { MarketingSite } from "@/components/marketing/marketing-site";
import { TenantSite } from "@/components/tenant/tenant-site";
import { VdsSite } from "@/components/vds/vds-site";

const searchSchema = z.object({
  tenant: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

const TITLE = "ERA Core: One operating system for local service businesses";
const DESCRIPTION =
  "ERA Core replaces the patchwork of booking apps, spreadsheets and invoicing tools with one system: website, AI chat, scheduling, payments and automations. Book a discovery call.";

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ tenant: search.tenant }),
  loader: async ({ deps }) => {
    // Marketing site is only served on the platform host with no tenant override.
    // Real tenant hostnames always resolve to their business before render.
    const [tenant, host] = await Promise.all([
      resolveTenant({ data: { tenant: deps.tenant } }),
      getHostContext(),
    ]);
    // A hostname nobody owns must resolve to nothing — never fall back to ERA.
    if (!tenant && !host.isPlatformHost) throw notFound();
    const showMarketing = !deps.tenant && (tenant === null || tenant.isPlatformHost);
    if (showMarketing)
      return { marketing: true as const, tenant: null, services: [], site: emptySiteContent() };
    const [services, site] = tenant
      ? await Promise.all([
          getTenantServices({ data: { businessId: tenant.businessId } }),
          getTenantSite({ data: { businessId: tenant.businessId } }),
        ])
      : [[], emptySiteContent()];
    return { marketing: false as const, tenant, services, site };
  },


  head: ({ loaderData }) => {
    const tenant = loaderData && !loaderData.marketing ? loaderData.tenant : null;

    // On a client's own domain nothing about ERA may appear — not the title,
    // not the share image, not ERA's pricing structured data.
    if (tenant) {
      const title = tenant.name;
      const description = `${tenant.name} — book online, view services and get in touch.`;
      return {
        meta: [
          { title },
          { name: "description", content: description },
          { property: "og:title", content: title },
          { property: "og:description", content: description },
          { name: "author", content: tenant.name },
          { property: "og:site_name", content: tenant.name },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary_large_image" },
        ],
      };
    }

    return {
      meta: [
        { title: TITLE },
        { name: "author", content: "ERA Systems" },
        { name: "description", content: DESCRIPTION },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { property: "og:url", content: "https://eraleadgen.com/" },
        { property: "og:image", content: "https://eraleadgen.com/og-era.jpg" },
        { name: "twitter:image", content: "https://eraleadgen.com/og-era.jpg" },
      ],
      links: [{ rel: "canonical", href: "https://eraleadgen.com/" }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "ERA Core",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            description: DESCRIPTION,
            offers: [
              { "@type": "Offer", name: "Basic", price: "199", priceCurrency: "USD" },
              { "@type": "Offer", name: "Growth", price: "499", priceCurrency: "USD" },
              { "@type": "Offer", name: "Enterprise", price: "1499", priceCurrency: "USD" },
            ],
          }),
        },
      ],
    };
  },

  component: Index,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <p className="max-w-md text-sm text-destructive">{error.message}</p>
    </div>
  ),
});

function Index() {
  const data = Route.useLoaderData();
  if (data.marketing) return <MarketingSite />;
  if (data.tenant?.slug === "vds") {
    return <VdsSite tenant={data.tenant} services={data.services} />;
  }
  return <TenantHome tenant={data.tenant} services={data.services} />;
}
