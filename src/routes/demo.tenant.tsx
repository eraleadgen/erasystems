import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { resolveTenant, getTenantServices } from "@/lib/tenant.functions";
import { TenantHome } from "@/components/tenant-home";

const searchSchema = z.object({
  tenant: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export const Route = createFileRoute("/demo/tenant")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ tenant: search.tenant }),
  loader: async ({ deps }) => {
    const tenant = await resolveTenant({ data: { tenant: deps.tenant } });
    const services = tenant
      ? await getTenantServices({ data: { businessId: tenant.businessId } })
      : [];
    return { tenant, services };
  },
  head: () => ({
    meta: [
      { title: "Tenant rendering demo — ERA Systems" },
      {
        name: "description",
        content:
          "Internal demo of ERA Systems hostname-based tenant resolution and business_id-scoped row-level security.",
      },
      { property: "og:title", content: "Tenant rendering demo — ERA Systems" },
      {
        property: "og:description",
        content: "Every request resolves its business from the incoming hostname before render.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => {
    const { tenant, services } = Route.useLoaderData();
    return <TenantHome tenant={tenant} services={services} />;
  },
});
