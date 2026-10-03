import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getAccountRouting } from "@/lib/business.functions";
import { startDeviceCheck } from "@/lib/device-client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in | ERA Systems" },
      {
        name: "description",
        content: "Sign in to your ERA Systems account. New accounts are created by invitation only.",
      },
      { property: "og:title", content: "Sign in | ERA Systems" },
      {
        property: "og:description",
        content: "ERA Systems accounts are issued by invitation after a discovery call.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const routing = useServerFn(getAccountRouting);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error(signInError.message);
      // New devices must enter an emailed code before anything else loads.
      const device = await startDeviceCheck();
      if (!device.trusted) return { verify: true as const, isStaff: false };
      // Staff land in the agency console, clients land in their own app.
      const r = await routing().catch(() => ({ isStaff: false, hasBusiness: false }));
      return { verify: false as const, isStaff: r.isStaff };
    },
    onSuccess: (result) => {
      if (result.verify) {
        void navigate({ to: "/verify-device", search: { next: "/dashboard", remember: remember ? "1" : "0" } });
        return;
      }
      void navigate({ to: result.isStaff ? "/admin/invites" : "/dashboard" });
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <main className="dark flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-center text-xl font-semibold text-foreground">Welcome back</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Sign in to continue your journey to a new era.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            mutation.mutate();
          }}
        >
          <div>
            <label className="block text-xs font-medium text-muted-foreground" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground" htmlFor="password">
              Password
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-md border border-border bg-background py-2 pl-3 pr-10 text-sm text-foreground"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-3.5"
              />
              Remember device for 30 days
            </label>
            <button
              type="button"
              onClick={async () => {
                setError(null);
                setNotice(null);
                if (!email) return setError("Enter your email above first.");
                await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                setNotice("If that email has an account, a reset link is on its way.");
              }}
              className="whitespace-nowrap text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </button>
          </div>

          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {mutation.isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
