import { useEffect, useState } from "react";

import { InstallApp } from "./install-app";

/**
 * The two apps a client gets: the business app they run their operations in,
 * and the customer app that is their own website in app form.
 *
 * A browser only installs the app whose manifest the current page advertises,
 * so the business app installs from here while the customer app is installed
 * from the client's own site — this panel links there and says so plainly.
 * The whole panel stays hidden unless the business app manifest exists, which
 * is the same add-on gate the manifest route enforces.
 */
export function AppDownloads({
  businessId,
  siteUrl,
}: {
  businessId: string;
  siteUrl: string | null;
}) {
  const [entitled, setEntitled] = useState(false);
  const [icon, setIcon] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/portal.webmanifest?b=${businessId}`, {
          credentials: "same-origin",
        });
        if (!res.ok || cancelled) return;
        const manifest = (await res.json()) as { icons?: { src: string }[] };
        if (cancelled) return;
        setIcon(manifest.icons?.[0]?.src ?? null);
        setEntitled(true);
      } catch {
        /* no apps offered */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (!entitled) return null;

  return (
    <section className="era-card p-5">
      <h2 className="text-sm font-semibold">Your apps</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Two apps you can add to a phone home screen: one for running the business, one for your
        customers.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            {icon ? <img src={icon} alt="" className="h-9 w-9 rounded-md" /> : null}
            <div>
              <p className="text-sm font-semibold">Business app</p>
              <p className="text-xs text-muted-foreground">
                Bookings, catalog, customers and billing.
              </p>
            </div>
          </div>
          <div className="mt-3">
            <InstallApp
              kind="team"
              businessId={businessId}
              className="flex flex-wrap items-center gap-2 text-xs"
            />
            <p className="text-xs text-muted-foreground">
              On iPhone: tap Share, then “Add to Home Screen”.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            {icon ? <img src={icon} alt="" className="h-9 w-9 rounded-md" /> : null}
            <div>
              <p className="text-sm font-semibold">Customer app</p>
              <p className="text-xs text-muted-foreground">
                Your website and booking, for your customers.
              </p>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            {siteUrl ? (
              <>
                <a
                  className="font-semibold text-foreground underline"
                  href={siteUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open your site
                </a>{" "}
                on a phone and add it to the home screen from there. Share the same link with
                customers so they can install it too.
              </>
            ) : (
              <>Available once your website address is connected.</>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
