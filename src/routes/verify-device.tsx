import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { safeNext, startDeviceCheck, verifyDeviceCode } from "@/lib/device-client";

export const Route = createFileRoute("/verify-device")({
  validateSearch: z.object({ next: z.string().optional(), remember: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Verify this device | ERA Systems" },
      { name: "description", content: "Enter the code we emailed to finish signing in to ERA Systems." },
      { property: "og:title", content: "Verify this device | ERA Systems" },
      { property: "og:description", content: "Enter the code we emailed to finish signing in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: VerifyDevicePage,
});

function VerifyDevicePage() {
  const { next, remember: rememberParam } = Route.useSearch();
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "code" | "error">("checking");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(rememberParam !== "0");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const target = safeNext(next, "/dashboard");

  const go = () => window.location.assign(target);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return void navigate({ to: "/auth" });
      try {
        const r = await startDeviceCheck();
        if (r.trusted) return go();
        setEmail(r.email ?? "");
        setState("code");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setState("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="dark flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">Check your email</h1>
        {state === "checking" ? (
          <p className="mt-3 text-sm text-muted-foreground">Checking this device…</p>
        ) : state === "error" ? (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        ) : (
          <form
            className="mt-4 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setBusy(true);
              try {
                await verifyDeviceCode(code.trim(), remember);
                go();
              } catch (err) {
                setError(err instanceof Error ? err.message : "That code isn't right.");
                setBusy(false);
              }
            }}
          >
            <p className="text-sm text-muted-foreground">
              We sent a 6-digit code from support@eraleadgen.com to {email || "your email"}. Enter it
              to finish signing in on this device.
            </p>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              aria-label="Verification code"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-center text-lg tracking-[0.4em] text-foreground"
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4" />
              Remember this device for 30 days
            </label>
            {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Checking…" : "Verify"}
            </button>
            <button
              type="button"
              onClick={async () => {
                setError(null);
                try {
                  const r = await startDeviceCheck(true);
                  setNotice(r.wait ? "A code was just sent. Wait a minute before asking again." : "A new code is on its way.");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not send a new code.");
                }
              }}
              className="w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Send a new code
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
