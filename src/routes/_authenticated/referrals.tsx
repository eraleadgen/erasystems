import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PortalShell } from "@/components/app/portal-page";
import { StatTile } from "@/components/app/stat-tile";
import { formatMoney } from "@/lib/entitlements";
import { referralLink, suggestReferralCode } from "@/lib/referrals";
import {
  getMyReferrals,
  setMyReferralActive,
  setMyReferralCode,
} from "@/lib/referrals.functions";

export const Route = createFileRoute("/_authenticated/referrals")({
  head: () => ({
    meta: [
      { title: "Referrals | ERA App" },
      {
        name: "description",
        content: "Share your partner link and see the bookings your referrals produced.",
      },
      { property: "og:title", content: "Referrals | ERA App" },
      {
        property: "og:description",
        content: "Share your partner link and see the bookings your referrals produced.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReferralsPage,
});

function ReferralsPage() {
  return (
    <PortalShell title="Referrals" feature="partner_network">
      {() => <ReferralsBody />}
    </PortalShell>
  );
}

function ReferralsBody() {
  const queryClient = useQueryClient();
  const fetchReferrals = useServerFn(getMyReferrals);
  const saveCode = useServerFn(setMyReferralCode);
  const toggleActive = useServerFn(setMyReferralActive);

  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const referrals = useQuery({
    queryKey: ["my-referrals"],
    queryFn: () => fetchReferrals(),
    retry: false,
  });

  const save = useMutation({
    mutationFn: (code: string) => saveCode({ data: { code } }),
    onSuccess: () => {
      setError(null);
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["my-referrals"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save that code."),
  });

  const flip = useMutation({
    mutationFn: (isActive: boolean) => toggleActive({ data: { isActive } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-referrals"] }),
  });

  const data = referrals.data;
  if (referrals.isLoading || !data) {
    return (
      <div className="era-card p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const link = data.code ? referralLink(origin, data.code) : "";

  return (
    <div className="space-y-6">
      <section className="era-card p-6">
        <h2 className="text-base font-semibold text-foreground">Your referral code</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send this link to anyone you point at another ERA business. Bookings made through
          it are credited to you. Customers can also type the code into a booking form.
        </p>

        {data.code ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-md border border-border px-3 py-2 font-mono text-sm text-foreground">
                {data.code}
              </span>
              <span
                className={`text-xs ${data.isActive ? "text-emerald-500" : "text-muted-foreground"}`}
              >
                {data.isActive ? "Active" : "Paused"}
              </span>
              <button
                type="button"
                className="text-xs underline text-muted-foreground"
                onClick={() => flip.mutate(!data.isActive)}
              >
                {data.isActive ? "Pause" : "Reactivate"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <code className="break-all rounded-md bg-muted px-3 py-2 text-xs text-foreground">
                {link}
              </code>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-2 text-xs text-foreground"
                onClick={async () => {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            You don&apos;t have a code yet. Pick one below.
          </p>
        )}

        <form
          className="mt-5 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const code = draft.trim().toUpperCase();
            if (!/^[A-Z0-9-]{4,24}$/.test(code)) {
              setError("Use 4–24 letters, numbers or dashes.");
              return;
            }
            save.mutate(code);
          }}
        >
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground">
              {data.code ? "Change your code" : "Choose your code"}
            </span>
            <input
              className="mt-1 w-56 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
              value={draft}
              placeholder={data.code ?? "PARTNER-1234"}
              onChange={(e) => setDraft(e.target.value.toUpperCase())}
            />
          </label>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-2 text-xs text-foreground"
            onClick={() => setDraft(suggestReferralCode("PARTNER"))}
          >
            Suggest one
          </button>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            disabled={save.isPending}
          >
            {save.isPending ? "Saving…" : "Save code"}
          </button>
        </form>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Referred bookings" value={String(data.totals.count)} />
        <StatTile label="Completed" value={String(data.totals.completed)} />
        <StatTile label="Value referred" value={formatMoney(data.totals.valueCents)} />
      </section>

      <section className="era-card p-6">
        <h2 className="text-base font-semibold text-foreground">Referrals you sent</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Customer contact details belong to the business that served the job, so they are
          not shown here.
        </p>
        {data.referrals.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Nothing yet. Bookings made through your link will appear here.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Business</th>
                  <th className="py-2 pr-4">Job date</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {data.referrals.map((r) => (
                  <tr key={r.bookingId} className="border-t border-border">
                    <td className="py-2 pr-4 text-foreground">{r.receivedByName}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {new Date(r.startsAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.status}</td>
                    <td className="py-2 pr-4 text-right text-foreground">
                      {formatMoney(r.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
