
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
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
