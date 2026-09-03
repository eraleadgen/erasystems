import { createFileRoute } from "@tanstack/react-router";

import { PortalPage } from "@/components/app/portal-page";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team | ERA App" },
      { name: "description", content: "Specialists and staff with access to your ERA workspace." },
      { property: "og:title", content: "Team | ERA App" },
      {
        property: "og:description",
        content: "Specialists and staff with access to your ERA workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  return (
    <PortalPage title="Team" feature="specialist_portal" empty="No team members yet.">
      {(ws) => (
        <div className="era-card overflow-hidden">
          <ul className="divide-y divide-border/60">
            {ws.team.map((m) => (
              <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 p-5">
                <p className="min-w-0 truncate text-sm text-foreground">{m.userId}</p>
                <span className="era-chip shrink-0">{m.role}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PortalPage>
  );
}
