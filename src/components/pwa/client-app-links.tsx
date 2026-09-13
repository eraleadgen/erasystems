import { useEffect, useState } from "react";

/**
 * Staff-side view of a client's two installable apps.
 *
 * Staff cannot install a client's app from their own machine in any meaningful
 * way, so this panel hands over the two addresses to send the client instead.
 * The gate is identical to the client's own dashboard panel: the per-business
 * manifest only exists for a live business with the Downloadable Apps add-on,
 * so the whole section stays hidden when it is not returned.
 */
export function ClientAppLinks({
  businessId,
  primaryDomain,
}: {
  businessId: string;
  primaryDomain: string | null;
}) {
  const [icon, setIcon] = useState<string | null>(null);
  const [entitled, setEntitled] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

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
        /* no apps offered for this client */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (!entitled) return null;

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const businessAppUrl = `${origin}/dashboard`;
  const customerAppUrl = primaryDomain ? `https://${primaryDomain}` : null;

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <section className="era-card p-6">
      <div className="flex items-center gap-3">
        {icon ? <img src={icon} alt="" className="h-9 w-9 rounded-md object-cover" /> : null}
        <div>
          <h2 className="text-base font-semibold">Downloadable apps</h2>
          <p className="text-sm text-muted-foreground">
            Send these to the client — each is installed by opening it on a phone and adding it to
            the home screen.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-semibold">Business app</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Bookings, catalog, customers and billing. The owner must be signed in.
          </p>
          <p className="mt-2 break-all text-xs text-muted-foreground">{businessAppUrl}</p>
          <button
            type="button"
            onClick={() => copy(businessAppUrl)}
            className="mt-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium"
          >
            {copied === businessAppUrl ? "Copied" : "Copy link"}
          </button>
        </div>

        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-semibold">Customer app</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Their website and booking, for their own customers.
          </p>
          {customerAppUrl ? (
            <>
              <p className="mt-2 break-all text-xs text-muted-foreground">{customerAppUrl}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copy(customerAppUrl)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
                >
                  {copied === customerAppUrl ? "Copied" : "Copy link"}
                </button>
                <a
                  href={customerAppUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
                >
                  Open
                </a>
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Available once their web address is connected.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
