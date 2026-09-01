import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { createInvite, listInvites, revokeInvite } from "@/lib/invites.functions";
import { INVITE_TTL_DAYS, inviteStatusLabel, inviteUrl, type InviteSummary } from "@/lib/invites";

export const Route = createFileRoute("/admin/invites")({
  head: () => ({
    meta: [
      { title: "Invitations — ERA Systems staff" },
      {
        name: "description",
        content:
          "Platform staff issue and withdraw single-use registration invitations for approved prospects.",
      },
      { property: "og:title", content: "Invitations — ERA Systems staff" },
      {
        property: "og:description",
        content: "Single-use, time-limited registration invites issued after a discovery call.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: InvitesAdmin,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center p-8">
      <p className="text-sm text-destructive">{error.message}</p>
    </main>
  ),
});

function InvitesAdmin() {
  const fetchInvites = useServerFn(listInvites);
  const issue = useServerFn(createInvite);
  const revoke = useServerFn(revokeInvite);
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [notes, setNotes] = useState("");
  const [issuedLink, setIssuedLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invitesQuery = useQuery({
    queryKey: ["invites"],
    queryFn: () => fetchInvites(),
    retry: false,
  });

  const issueMutation = useMutation({
    mutationFn: () => issue({ data: { email, fullName, notes: notes || undefined } }),
    onSuccess: (result) => {
      const origin = typeof window === "undefined" ? "" : window.location.origin;
      setIssuedLink(inviteUrl(origin, result.token));
      setEmail("");
      setFullName("");
      setNotes("");
      void queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invites"] }),
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-foreground">Invitations</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Each invite is single-use, tied to one email address, and expires after {INVITE_TTL_DAYS}{" "}
        days. The link is shown once — copy it now, it cannot be retrieved later.
      </p>

      <form
        className="mt-8 grid gap-4 rounded-xl border border-border bg-card p-6 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setIssuedLink(null);
          issueMutation.mutate();
        }}
      >
        <div>
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="fullName">
            Prospect name
          </label>
          <input
            id="fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="inviteEmail">
            Email
          </label>
          <input
            id="inviteEmail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="notes">
            Discovery-call notes (internal)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={issueMutation.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {issueMutation.isPending ? "Generating…" : "Generate invite link"}
          </button>
        </div>
      </form>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      {issuedLink ? (
        <div className="mt-6 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Copy this link now — shown once
          </p>
          <code className="mt-2 block break-all text-sm text-foreground">{issuedLink}</code>
        </div>
      ) : null}

      <h2 className="mt-12 text-lg font-semibold text-foreground">Issued invitations</h2>
      {invitesQuery.isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : invitesQuery.error ? (
        <p className="mt-3 text-sm text-destructive">
          Only platform staff can view invitations. Sign in with a staff account.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
          {(invitesQuery.data ?? []).map((invite: InviteSummary) => (
            <li key={invite.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-sm font-medium text-foreground">{invite.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {invite.email} · {inviteStatusLabel(invite)} · expires{" "}
                  {new Date(invite.expiresAt).toLocaleDateString()}
                </p>
              </div>
              {invite.status === "pending" ? (
                <button
                  type="button"
                  onClick={() => revokeMutation.mutate(invite.id)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground"
                >
                  Revoke
                </button>
              ) : null}
            </li>
          ))}
          {(invitesQuery.data ?? []).length === 0 ? (
            <li className="px-5 py-4 text-sm text-muted-foreground">No invitations yet.</li>
          ) : null}
        </ul>
      )}
    </main>
  );
}
