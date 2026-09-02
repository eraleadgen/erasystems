import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { previewInvite, redeemInvite } from "@/lib/invites.functions";
import { GENERIC_INVITE_ERROR } from "@/lib/invites";

const searchSchema = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/register")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Complete your registration | ERA Systems" },
      {
        name: "description",
        content:
          "Create your ERA Systems account using the private invite link issued after your discovery call.",
      },
      { property: "og:title", content: "Complete your registration | ERA Systems" },
      {
        property: "og:description",
        content: "Registration on ERA Systems is by invitation only.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RegisterPage,
  errorComponent: ({ error }) => (
    <Shell>
      <p className="text-sm text-destructive">{error.message}</p>
    </Shell>
  ),
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        {children}
      </div>
    </main>
  );
}

function RegisterPage() {
  const { token } = Route.useSearch();
  const preview = useServerFn(previewInvite);
  const redeem = useServerFn(redeemInvite);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const inviteQuery = useQuery({
    queryKey: ["invite-preview", token],
    enabled: Boolean(token),
    retry: false,
    queryFn: () => preview({ data: { token: token as string } }),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await redeem({
        data: { token: token as string, email: inviteQuery.data!.email, password },
      });
      // Open signup is disabled, so this is a sign-in for an account the server just made.
      const { error } = await supabase.auth.signInWithPassword({
        email: result.email,
        password,
      });
      if (error) throw new Error(error.message);
      return result;
    },
    onSuccess: () => setDone(true),
    onError: (error: Error) => setFormError(error.message),
  });

  if (!token || (!inviteQuery.isLoading && !inviteQuery.data)) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-foreground">Invitation required</h1>
        <p className="mt-3 text-sm text-muted-foreground">{GENERIC_INVITE_ERROR}</p>
      </Shell>
    );
  }

  if (inviteQuery.isLoading) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">Checking your invitation…</p>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-foreground">You're registered</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your ERA Systems account is active. Next, set up your business, details, branding and
          services. No payment is taken during setup.
        </p>
        <Link
          to="/onboarding"
          className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Start business setup
        </Link>
      </Shell>
    );
  }


  const invite = inviteQuery.data!;

  return (
    <Shell>
      <h1 className="text-xl font-semibold text-foreground">Welcome, {invite.fullName}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Set a password to create your ERA Systems account. This creates your login only, your
        business is set up later in onboarding.
      </p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setFormError(null);
          if (password.length < 10) {
            setFormError("Use at least 10 characters.");
            return;
          }
          if (password !== confirm) {
            setFormError("Passwords do not match.");
            return;
          }
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
            value={invite.email}
            readOnly
            className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="confirm">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>

        {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {mutation.isPending ? "Creating account…" : "Create account"}
        </button>
      </form>
    </Shell>
  );
}
