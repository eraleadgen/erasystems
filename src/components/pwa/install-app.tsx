import { useEffect, useState } from "react";

/**
 * Install prompt for the two per-business apps.
 *
 * The manifest itself is the gate: it only exists for a live business with the
 * Downloadable Apps add-on. This component asks for it first and stays
 * completely invisible when it is not there, so a client without the add-on
 * sees exactly what they see today.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallApp({
  kind,
  businessId,
  className,
}: {
  kind: "customer" | "team";
  businessId?: string;
  className?: string;
}) {
  const href =
    kind === "team"
      ? businessId
        ? `/portal.webmanifest?b=${businessId}`
        : null
      : "/site.webmanifest";

  const [available, setAvailable] = useState(false);
  const [themeColor, setThemeColor] = useState<string | null>(null);
  const [iconHref, setIconHref] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!href || isStandalone()) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(href, { credentials: "same-origin" });
        if (!res.ok || cancelled) return;
        const manifest = (await res.json()) as {
          theme_color?: string;
          icons?: { src: string }[];
        };
        if (cancelled) return;

        // Only now does the page advertise an installable app.
        const link = document.createElement("link");
        link.rel = "manifest";
        link.href = href;
        document.head.appendChild(link);

        const icon = manifest.icons?.[0]?.src ?? null;
        if (icon) {
          const apple = document.createElement("link");
          apple.rel = "apple-touch-icon";
          apple.href = icon;
          document.head.appendChild(apple);
        }
        if (manifest.theme_color) {
          const meta = document.createElement("meta");
          meta.name = "theme-color";
          meta.content = manifest.theme_color;
          document.head.appendChild(meta);
          setThemeColor(manifest.theme_color);
        }
        setIconHref(icon);
        setAvailable(true);
      } catch {
        /* no app offered */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [href]);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!available || dismissed) return null;

  const ios = isIos();
  if (!prompt && !ios) return null;

  return (
    <div
      className={
        className ??
        "flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm"
      }
    >
      {iconHref ? (
        <img src={iconHref} alt="" className="h-8 w-8 rounded-md object-cover" />
      ) : null}
      <p className="min-w-0 flex-1 text-muted-foreground">
        {ios
          ? "Add this app to your home screen: tap Share, then “Add to Home Screen”."
          : kind === "team"
            ? "Install the team app for one-tap access to your dashboard."
            : "Install our app for quicker booking."}
      </p>
      {prompt ? (
        <button
          type="button"
          onClick={async () => {
            await prompt.prompt();
            setPrompt(null);
            setDismissed(true);
          }}
          className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
          style={{ backgroundColor: themeColor ?? "#0f766e" }}
        >
          Install app
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground"
      >
        Not now
      </button>
    </div>
  );
}
