import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
import {
  addClientDomain,
  getClientActivity,
  getClientProfile,
  removeClientDomain,
  saveClientProvisioning,
  setClientDomainVerified,
  setPrimaryClientDomain,
  type ClientProfile,
} from "@/lib/clients.functions";
import { getDeliveryBoard } from "@/lib/delivery-tasks.functions";
import { getAiAgentDelivery } from "@/lib/ai-agents.functions";
import { AI_AGENT_TRACK_LIST, trackProgress } from "@/lib/ai-agents";
import { ADDON_LABELS, FEATURE_LABELS, formatMoney } from "@/lib/entitlements";
import { getBusinessAddons, getMyEntitlements } from "@/lib/entitlements.functions";
import {
  getLaunchStatus,
  setLaunchStatus,
  LAUNCH_STATUSES,
  type LaunchStatus,
} from "@/lib/launch-status.functions";
import { StatusLight, statusFor } from "@/components/app/launch-status";
import { DeliveryWorkspace } from "@/components/app/delivery-workspace";
import { AiAgentDeliveryEditor } from "@/components/app/ai-agent-delivery";

export const Route = createFileRoute("/_authenticated/admin/clients/$businessId")({
  head: () => ({
    meta: [
      { title: "Client profile | ERA Systems" },
      {
        name: "description",
        content:
          "Finish a paid ERA client account: requested domain, A2P registration, customer website and the final launch overview.",
      },
      { property: "og:title", content: "Client profile | ERA Systems" },
      {
        property: "og:description",
        content: "Provisioning checklist for a paid ERA client account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ClientProfilePage,
  errorComponent: ({ error }) => (
    <AppShell title="Client profile" variant="staff">
      <div className="era-card p-6">
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    </AppShell>
  ),
});

const inputClass =
  "w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-2 text-sm">
      <span className="min-w-0 text-muted-foreground">{label}</span>
      <span className="shrink-0 font-medium">{value}</span>
    </div>
  );
}

function ClientProfilePage() {
  const { businessId } = Route.useParams();
  const fetchProfile = useServerFn(getClientProfile);
  const saveProvisioning = useServerFn(saveClientProvisioning);
  const queryClient = useQueryClient();

  const { data: hasSession } = useQuery({
    queryKey: ["has-session"],
    queryFn: async () => Boolean((await supabase.auth.getSession()).data.session),
    retry: false,
  });

  const profileQuery = useQuery({
    queryKey: ["client-profile", businessId],
    queryFn: () => fetchProfile({ data: { businessId } }),
    enabled: hasSession === true,
    retry: false,
  });

  const profile = profileQuery.data ?? null;
  const [form, setForm] = useState(profile?.provisioning ?? null);

  useEffect(() => {
    if (profile) setForm(profile.provisioning);
  }, [profile]);

  const mutation = useMutation({
    mutationFn: (markComplete: boolean) =>
      saveProvisioning({ data: { businessId, ...form!, markComplete } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["client-profile", businessId] }),
  });

  if (hasSession === false) {
    return (
      <AppShell title="Client profile" variant="staff">
        <div className="era-card p-6">
          <p className="text-sm text-muted-foreground">Sign in with your ERA staff account.</p>
        </div>
      </AppShell>
    );
  }

  if (profileQuery.isLoading || !profile || !form) {
    return (
      <AppShell title="Client profile" variant="staff">
        <div className="era-card p-6">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={profile.name} variant="staff">
      <div className="space-y-6">
        <Link to="/admin/clients" className="text-xs text-muted-foreground hover:text-foreground">
          ← All clients
        </Link>

        <ClientSummary businessId={businessId} profile={profile} />



        <div className="grid gap-6 lg:grid-cols-2">
          <section className="era-card p-6">
            <h2 className="text-base font-semibold">Business</h2>
            <div className="mt-3 divide-y divide-border/50">
              <Row label="Legal name" value={profile.legalName ?? "Not provided"} />
              <Row
                label="Web address"
                value={profile.primaryDomain ?? `/${profile.slug} (no domain connected)`}
              />
              <Row label="Tier" value={profile.planTier} />
              <Row label="Lifecycle" value={profile.lifecycle} />
              <Row label="Timezone" value={profile.timezone} />
              <Row label="Contact email" value={profile.supportEmail ?? "Not provided"} />
              <Row label="Contact phone" value={profile.supportPhone ?? "Not provided"} />
              <Row
                label="Add-ons"
                value={
                  profile.addons.length
                    ? profile.addons
                        .map(
                          (a) =>
                            `${ADDON_LABELS[a.addon]} (${a.isActive ? "active" : "pending"}, ${formatMoney(a.priceCents)})`,
                        )
                        .join(", ")
                    : "None"
                }
              />
              <Row label="Services" value={String(profile.services.length)} />
              <Row
                label="Referral code"
                value={
                  profile.referral
                    ? `${profile.referral.code} (${profile.referral.isActive ? "active" : "paused"}) · ${profile.referral.sentCount} referred`
                    : "None"
                }
              />
              <Row
                label="Last payment"
                value={
                  profile.payments[0]
                    ? `${formatMoney(profile.payments[0].amountCents)} · ${profile.payments[0].status}`
                    : "None"
                }
              />
              <Row label="Account created" value={new Date(profile.createdAt).toLocaleDateString()} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/dashboard"
                search={{ as: profile.id }}
                className="inline-flex rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground"
              >
                Open client portal
              </Link>
              {/* A client with their own live address is best previewed there:
                  the internal ?tenant= preview is a build-time view and, for
                  ERA's own record, renders a stub instead of the real site. */}
              {profile.primaryDomain ? (
                <a
                  href={`https://${profile.primaryDomain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                >
                  Open {profile.primaryDomain}
                </a>
              ) : (
                <a
                  href={`/?tenant=${profile.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                >
                  Preview client website
                </a>
              )}
            </div>

          </section>


          <section className="era-card p-6">
            <h2 className="text-base font-semibold">Membership</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Signed terms, billing and everyone with access to this account.
            </p>
            <div className="mt-3 divide-y divide-border/50">
              {profile.membership ? (
                <>
                  <Row label="Signed by" value={profile.membership.fullName} />
                  <Row label="Invite email" value={profile.membership.email} />
                  <PasswordResetRow email={profile.membership.email} />
                  <Row
                    label="Subscription"
                    value={`${formatMoney(profile.membership.subscriptionPriceCents)} / ${profile.membership.billingInterval}`}
                  />
                  <Row
                    label="Setup fee"
                    value={
                      profile.membership.setupFeeCents
                        ? formatMoney(profile.membership.setupFeeCents)
                        : "None"
                    }
                  />
                  <Row
                    label="Accepted"
                    value={
                      profile.membership.acceptedAt
                        ? new Date(profile.membership.acceptedAt).toLocaleDateString()
                        : "Not yet"
                    }
                  />
                </>
              ) : (
                <Row label="Origin" value="Created without an invite" />
              )}
              <Row
                label="Domains"
                value={
                  profile.domains.length
                    ? profile.domains
                        .map(
                          (d) =>
                            `${d.hostname}${d.isPrimary ? " (primary)" : ""}${d.verifiedAt ? "" : " · unverified"}`,
                        )
                        .join(", ")
                    : "None connected"
                }
              />
              <Row
                label="Users with access"
                value={
                  profile.members.length
                    ? profile.members.map((m) => m.role).join(", ")
                    : "None"
                }
              />
            </div>

            {profile.payments.length > 0 && (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Payment history
                </p>
                <ul className="mt-2 divide-y divide-border/50">
                  {profile.payments.map((p) => (
                    <li
                      key={p.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString()} · {p.status}
                      </span>
                      <span className="shrink-0 font-medium">{formatMoney(p.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="era-card p-6">
            <h2 className="text-base font-semibold">Finish provisioning</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything this account needs before it runs on autopilot.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Requested domain
                </label>
                <input
                  className={inputClass}
                  value={form.requestedDomain}
                  onChange={(e) => setForm({ ...form, requestedDomain: e.target.value })}
                  placeholder="clientdomain.com"
                />
                <select
                  className={`${inputClass} mt-2`}
                  value={form.domainStatus}
                  onChange={(e) => setForm({ ...form, domainStatus: e.target.value })}
                >
                  <option value="not_started">Domain: not started</option>
                  <option value="in_progress">Domain: in progress</option>
                  <option value="live">Domain: live</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.a2pRequired}
                    onChange={(e) => setForm({ ...form, a2pRequired: e.target.checked })}
                  />
                  A2P registration required (AI voice or SMS agents)
                </label>
                <select
                  className={`${inputClass} mt-2`}
                  value={form.a2pStatus}
                  onChange={(e) => setForm({ ...form, a2pStatus: e.target.value })}
                >
                  <option value="not_started">A2P: not started</option>
                  <option value="submitted">A2P: submitted</option>
                  <option value="approved">A2P: approved</option>
                  <option value="not_applicable">A2P: not applicable</option>
                </select>
                <textarea
                  className={`${inputClass} mt-2`}
                  rows={2}
                  value={form.a2pNotes}
                  onChange={(e) => setForm({ ...form, a2pNotes: e.target.value })}
                  placeholder="Campaign notes, brand id, carrier feedback"
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Customer website
                </label>
                <input
                  className={inputClass}
                  value={form.websiteUrl}
                  onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                  placeholder="https://…"
                />
                <select
                  className={`${inputClass} mt-2`}
                  value={form.websiteStatus}
                  onChange={(e) => setForm({ ...form, websiteStatus: e.target.value })}
                >
                  <option value="not_started">Website: not started</option>
                  <option value="in_progress">Website: in progress</option>
                  <option value="live">Website: live</option>
                </select>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Final overview
                </label>
                <textarea
                  className={inputClass}
                  rows={4}
                  value={form.overviewNotes}
                  onChange={(e) => setForm({ ...form, overviewNotes: e.target.value })}
                  placeholder="What was configured, what the client was walked through, anything outstanding."
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="era-button-primary"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate(false)}
                >
                  {mutation.isPending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-border/70 px-4 py-2 text-sm"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate(true)}
                >
                  Mark provisioning complete
                </button>
              </div>
              {form.completedAt && (
                <p className="text-xs text-muted-foreground">
                  Completed {new Date(form.completedAt).toLocaleString()}
                </p>
              )}
              {mutation.isError && (
                <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
              )}
            </div>
          </section>

          <DomainManager
            businessId={businessId}
            domains={profile.domains}
            slug={profile.slug}
          />

          <LaunchStatusEditor businessId={businessId} />

          <AiAgentDeliveryEditor businessId={businessId} />

          <DeliveryWorkspace
            businessId={businessId}
            planTier={profile.planTier}
            createdAt={profile.createdAt}
          />
        </div>
      </div>
    </AppShell>
  );
}

/**
 * Staff control for what the client sees on their portal: one switch per
 * capability in that client's plan. Writes are authorized by the
 * is_platform_staff() policy on business_launch_status.
 */
function LaunchStatusEditor({ businessId }: { businessId: string }) {
  const fetchEntitlements = useServerFn(getMyEntitlements);
  const fetchAddons = useServerFn(getBusinessAddons);
  const fetchStatus = useServerFn(getLaunchStatus);
  const setStatus = useServerFn(setLaunchStatus);
  const queryClient = useQueryClient();

  const entitlements = useQuery({
    queryKey: ["client-entitlements", businessId],
    queryFn: () => fetchEntitlements({ data: { businessId } }),
    retry: false,
  });
  const addons = useQuery({
    queryKey: ["client-addons", businessId],
    queryFn: () => fetchAddons({ data: { businessId } }),
    retry: false,
  });
  const statuses = useQuery({
    queryKey: ["launch-status", businessId],
    queryFn: () => fetchStatus({ data: { businessId } }),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (vars: { itemKey: string; status: LaunchStatus }) =>
      setStatus({ data: { businessId, ...vars } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["launch-status", businessId] });
    },
  });

  const items = [
    ...(entitlements.data?.features ?? [])
      // The AI agents are tracked step by step in their own checklists below.
      .filter((f) => f !== "voice_sms_agent")
      .map((f) => ({ key: f as string, label: FEATURE_LABELS[f] })),
    ...(addons.data ?? [])
      .filter((a) => a.isActive)
      .map((a) => ({ key: a.addon as string, label: ADDON_LABELS[a.addon] })),
  ];

  const rows = statuses.data ?? [];

  return (
    <section className="era-card p-5">
      <h2 className="text-base font-semibold">Client-visible status</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Flip each part of the build as you finish it. The client sees these lights on their
        portal.
      </p>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No entitled features yet.</p>
      ) : (
        <ul className="mt-4">
          {items.map((item) => {
            const current = statusFor(rows, item.key);
            return (
              <li
                key={item.key}
                className="era-hairline grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{item.label}</p>
                  <StatusLight status={current} />
                </div>
                <div className="flex shrink-0 gap-1">
                  {LAUNCH_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ itemKey: item.key, status: s })}
                      className={`rounded-md border px-2.5 py-1 text-xs transition ${
                        current === s
                          ? "border-primary bg-primary/15 text-foreground"
                          : "border-border/70 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s === "in_progress" ? "In progress" : s === "live" ? "Live" : "Pending"}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {mutation.isError && (
        <p className="mt-3 text-sm text-destructive">{(mutation.error as Error).message}</p>
      )}
    </section>
  );
}


/**
 * Per-client web addresses. Every write names this client's business_id
 * explicitly and runs through the caller's RLS-scoped client; the
 * business_domains staff/manager policies are the authorization.
 *
 * Note: connecting the address at the hosting layer is a separate step done in
 * project settings. Marking it verified here only records that DNS is confirmed,
 * which is what makes the mapping publicly readable.
 */
function DomainManager({
  businessId,
  domains,
  slug,
}: {
  businessId: string;
  domains: { hostname: string; isPrimary: boolean; verifiedAt: string | null }[];
  slug: string;
}) {
  const queryClient = useQueryClient();
  const add = useServerFn(addClientDomain);
  const remove = useServerFn(removeClientDomain);
  const makePrimary = useServerFn(setPrimaryClientDomain);
  const setVerified = useServerFn(setClientDomainVerified);
  const [hostname, setHostname] = useState("");

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["client-profile", businessId] });

  const addMutation = useMutation({
    mutationFn: (host: string) =>
      add({ data: { businessId, hostname: host, isPrimary: domains.length === 0 } }),
    onSuccess: () => {
      setHostname("");
      void refresh();
    },
  });
  const actionMutation = useMutation({
    mutationFn: async (a: { kind: "remove" | "primary" | "verify" | "unverify"; host: string }) => {
      if (a.kind === "remove") return remove({ data: { businessId, hostname: a.host } });
      if (a.kind === "primary") return makePrimary({ data: { businessId, hostname: a.host } });
      return setVerified({
        data: { businessId, hostname: a.host, verified: a.kind === "verify" },
      });
    },
    onSuccess: () => void refresh(),
  });

  const busy = addMutation.isPending || actionMutation.isPending;
  const error = (addMutation.error ?? actionMutation.error) as Error | null;

  return (
    <section className="era-card p-5">
      <h2 className="text-base font-semibold">Web addresses</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Addresses that serve this client&apos;s website. Preview it any time at{" "}
        <Link to="/" search={{ tenant: slug }} className="text-foreground underline">
          /?tenant={slug}
        </Link>
        .
      </p>

      {domains.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No address connected yet.</p>
      ) : (
        <ul className="mt-4">
          {domains.map((d) => (
            <li
              key={d.hostname}
              className="era-hairline flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">
                  {d.hostname}
                  {d.isPrimary && (
                    <span className="ml-2 rounded border border-primary/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                      Primary
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {d.verifiedAt
                    ? `Verified ${new Date(d.verifiedAt).toLocaleDateString()}`
                    : "Not verified — the public site will not serve on this address"}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                {!d.isPrimary && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => actionMutation.mutate({ kind: "primary", host: d.hostname })}
                    className="rounded-md border border-border/70 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Make primary
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    actionMutation.mutate({
                      kind: d.verifiedAt ? "unverify" : "verify",
                      host: d.hostname,
                    })
                  }
                  className="rounded-md border border-border/70 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {d.verifiedAt ? "Mark unverified" : "Mark verified"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => actionMutation.mutate({ kind: "remove", host: d.hostname })}
                  className="rounded-md border border-border/70 px-2.5 py-1 text-xs text-destructive"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          className={`${inputClass} max-w-xs flex-1`}
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
          placeholder="clientdomain.com"
        />
        <button
          type="button"
          className="era-button-primary"
          disabled={busy || hostname.trim().length < 4}
          onClick={() => addMutation.mutate(hostname.trim().toLowerCase())}
        >
          {addMutation.isPending ? "Adding…" : "Add address"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error.message}</p>}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string | undefined }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-primary">
      {children}
    </span>
  );
}

/**
 * At-a-glance summary of one client. Every figure comes from the same server
 * functions the individual features already use — the delivery board, the AI
 * agent tracks, the referral rollup on the client profile and the shared
 * analytics calculation. Nothing is recalculated here.
 */
function ClientSummary({
  businessId,
  profile,
}: {
  businessId: string;
  profile: ClientProfile;
}) {
  const fetchActivity = useServerFn(getClientActivity);
  const fetchBoard = useServerFn(getDeliveryBoard);
  const fetchAi = useServerFn(getAiAgentDelivery);

  const activity = useQuery({
    queryKey: ["client-activity", businessId],
    queryFn: () => fetchActivity({ data: { businessId } }),
    retry: false,
  });
  const board = useQuery({
    queryKey: ["delivery-board", businessId],
    queryFn: () => fetchBoard({ data: { businessId } }),
    retry: false,
  });
  const ai = useQuery({
    queryKey: ["ai-agent-delivery", businessId],
    queryFn: () => fetchAi({ data: { businessId } }),
    enabled: profile.planTier === "enterprise",
    retry: false,
  });

  const tasks = board.data?.tasks ?? [];
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const blockedTasks = tasks.filter((t) => t.status === "blocked").length;
  const deliveryPct = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0;

  const activeAddons = profile.addons.filter((a) => a.isActive);
  const enabledTracks = AI_AGENT_TRACK_LIST.filter((t) =>
    (ai.data?.enabledTracks ?? []).includes(t.track),
  );

  return (
    <section className="era-card p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">Summary</h2>
        <Pill>{profile.planTier}</Pill>
        <Pill>{profile.lifecycle.replace(/_/g, " ")}</Pill>
        {profile.isActive ? <Pill>live</Pill> : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Revenue · last 30 days"
          value={activity.data ? formatMoney(activity.data.revenueCents) : "—"}
          hint={
            activity.data
              ? `${activity.data.completedJobs} completed${
                  activity.data.revenueChangePct === null
                    ? ""
                    : ` · ${activity.data.revenueChangePct > 0 ? "+" : ""}${activity.data.revenueChangePct}% vs prior`
                }`
              : "Loading…"
          }
        />
        <Stat
          label="Pipeline"
          value={activity.data ? formatMoney(activity.data.pipelineCents) : "—"}
          hint={activity.data ? `${activity.data.pipelineJobs} upcoming` : undefined}
        />
        <Stat
          label="Average ticket"
          value={activity.data ? formatMoney(activity.data.averageTicketCents) : "—"}
        />
        <Stat
          label="Delivery checklist"
          value={board.data ? `${deliveryPct}%` : "—"}
          hint={
            board.data
              ? `${doneTasks} of ${tasks.length} done${blockedTasks ? ` · ${blockedTasks} blocked` : ""}`
              : "Loading…"
          }
        />
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Active add-ons</p>
          {activeAddons.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">None</p>
          ) : (
            <ul className="mt-2 divide-y divide-border/50">
              {activeAddons.map((a) => (
                <li
                  key={a.addon}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">{ADDON_LABELS[a.addon]}</span>
                  <span className="shrink-0 font-medium">{formatMoney(a.priceCents)}</span>
                </li>
              ))}
            </ul>
          )}

          {profile.planTier === "enterprise" && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">AI agents</p>
              {enabledTracks.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No agent tracks enabled.</p>
              ) : (
                <ul className="mt-2 divide-y divide-border/50">
                  {enabledTracks.map((t) => {
                    const p = trackProgress(ai.data?.steps ?? [], t);
                    return (
                      <li
                        key={t.track}
                        className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate">{t.label}</span>
                        <span className="shrink-0 font-medium">
                          {p.done} / {p.total}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {profile.referral && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Partner network
              </p>
              <p className="mt-2 text-sm">
                {profile.referral.code} · {profile.referral.isActive ? "active" : "paused"} ·{" "}
                {profile.referral.sentCount} referred
              </p>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Recent bookings</p>
          {activity.isLoading ? (
            <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
          ) : (activity.data?.recent.length ?? 0) === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No bookings yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border/50">
              {activity.data!.recent.map((b) => (
                <li key={b.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {b.customerName}
                    <span className="text-muted-foreground">
                      {" "}
                      · {new Date(b.startsAt).toLocaleDateString()} · {b.status}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium">{formatMoney(b.totalCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {(activity.isError || board.isError) && (
        <p className="mt-3 text-sm text-destructive">
          {((activity.error ?? board.error) as Error).message}
        </p>
      )}
    </section>
  );
}

function PasswordResetRow({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span className="text-muted-foreground">Password reset</span>
      <div className="flex items-center gap-3">
        {state === "sent" ? <span className="text-xs text-muted-foreground">Reset email sent to {email}</span> : null}
        {state === "error" ? <span className="text-xs text-destructive">Couldn't send, try again</span> : null}
        <button
          type="button"
          disabled={state === "sending"}
          onClick={async () => {
            setState("sending");
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: `${window.location.origin}/reset-password`,
            });
            setState(error ? "error" : "sent");
          }}
          className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          {state === "sending" ? "Sending…" : "Send reset email"}
        </button>
      </div>
    </div>
  );
}
