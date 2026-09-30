import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset your password | ERA Systems" },
      { name: "description", content: "Choose a new password for your ERA Systems account." },
      { property: "og:title", content: "Reset your password | ERA Systems" },
      { property: "og:description", content: "Choose a new password for your ERA Systems account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    void supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 10) return setError("Use at least 10 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError(err.message);
    setDone(true);
    setTimeout(() => void navigate({ to: "/dashboard" }), 1500);
  };

  return (
    <main className="dark flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">Set a new password</h1>
        {done ? (
          <p className="mt-3 text-sm text-muted-foreground">Password updated. Taking you to your portal…</p>
        ) : !ready ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Checking your reset link… If nothing happens, the link may have expired. Request a new
            one from the sign-in page.
          </p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div>
              <label className="block text-xs font-medium text-muted-foreground" htmlFor="pw">
                New password
              </label>
              <div className="relative mt-1">
                <input
                  id="pw"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-border bg-background py-2 pl-3 pr-10 text-sm text-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground" htmlFor="pw2">
                Confirm password
              </label>
              <input
                id="pw2"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
