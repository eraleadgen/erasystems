import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { DocumentLibrary } from "@/components/app/document-library";

const TITLE = "Sales | ERA Systems staff";
const DESCRIPTION = "Presentations, ads, analytics, and the ERA sales guide and flow.";

export const Route = createFileRoute("/_authenticated/admin/sales")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SalesAdmin,
});

function SalesAdmin() {
  const { data: hasSession } = useQuery({
    queryKey: ["has-session"],
    queryFn: async () => Boolean((await supabase.auth.getSession()).data.session),
    retry: false,
  });

  return (
    <AppShell title="Sales" variant="staff">
      <DocumentLibrary
        hasSession={hasSession === true}
        options={[{ value: "sales", label: "Sales and marketing asset" }]}
        groups={[
          {
            key: "sales",
            label: "Sales and marketing assets",
            hint: "Presentations, ad creative, analytics reports, website material, sales guides and call flows.",
          },
        ]}
      />
    </AppShell>
  );
}
