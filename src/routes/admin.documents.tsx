import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import { DocumentLibrary } from "@/components/app/document-library";

const TITLE = "Documents | ERA Systems staff";
const DESCRIPTION = "Service agreements, policies, and signed client contracts.";

export const Route = createFileRoute("/admin/documents")({
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
  component: DocumentsAdmin,
});

function DocumentsAdmin() {
  const { data: hasSession } = useQuery({
    queryKey: ["has-session"],
    queryFn: async () => Boolean((await supabase.auth.getSession()).data.session),
    retry: false,
  });

  return (
    <AppShell title="Documents" variant="staff">
      <DocumentLibrary
        hasSession={hasSession === true}
        options={[
          { value: "legal", label: "Legal (agreement, terms, privacy)" },
          { value: "contract", label: "Client contract" },
        ]}
        groups={[
          {
            key: "legal",
            label: "Legal",
            hint: "Service agreement, terms and conditions, privacy policy.",
          },
          { key: "contract", label: "Client contracts", hint: "Signed agreements per client." },
        ]}
      />
    </AppShell>
  );
}
