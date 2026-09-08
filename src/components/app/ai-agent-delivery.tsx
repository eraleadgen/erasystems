import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  AI_AGENT_TRACK_LIST,
  AI_STEP_STATUSES,
  AI_STEP_STATUS_LABELS,
  stepStatus,
  trackProgress,
  type AiAgentStepRow,
  type AiAgentTrack,
  type AiStepStatus,
} from "@/lib/ai-agents";
import {
  getAiAgentDelivery,
  setAiAgentStep,
  setAiAgentTrack,
} from "@/lib/ai-agents.functions";

const STATUS_STYLE: Record<AiStepStatus, { dot: string; text: string }> = {
  not_started: { dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
  in_progress: {
    dot: "bg-[oklch(0.78_0.15_85)] shadow-[0_0_10px_oklch(0.78_0.15_85_/_60%)]",
    text: "text-[oklch(0.85_0.12_88)]",
  },
  blocked: {
    dot: "bg-[oklch(0.68_0.19_25)] shadow-[0_0_10px_oklch(0.68_0.19_25_/_60%)]",
    text: "text-[oklch(0.78_0.16_28)]",
  },
  done: {
    dot: "bg-[oklch(0.78_0.16_150)] shadow-[0_0_10px_oklch(0.78_0.16_150_/_60%)]",
    text: "text-[oklch(0.84_0.13_155)]",
  },
};

function StepLight({ status }: { status: AiStepStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-semibold ${s.text}`}>
      <i className={`size-2.5 shrink-0 rounded-full ${s.dot}`} aria-hidden />
      {AI_STEP_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Client-facing view. Only tracks a staff member explicitly switched on for
 * this business appear at all: a client who is not getting the voice agent
 * never sees a voice agent row, not even as "pending".
 */
export function AiAgentStatusPanel({ businessId }: { businessId: string }) {
  const fetchDelivery = useServerFn(getAiAgentDelivery);

  const delivery = useQuery({
    queryKey: ["ai-agent-delivery", businessId],
    queryFn: () => fetchDelivery({ data: { businessId } }),
    retry: false,
  });

  const enabled = delivery.data?.enabledTracks ?? [];
  const tracks = AI_AGENT_TRACK_LIST.filter((t) => enabled.includes(t.track));
  if (delivery.isPending || tracks.length === 0) return null;

  const steps: AiAgentStepRow[] = delivery.data?.steps ?? [];

  return (
    <section className="era-card p-6 sm:p-7">
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        Your AI agent setup
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Only the agents you are getting are listed. Your ERA team updates each step by hand as the
        work is actually completed.
      </p>

      <div className="mt-5 space-y-6">
        {tracks.map((track) => {
          const p = trackProgress(steps, track);
          return (
            <div key={track.track}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{track.clientLabel}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{track.clientNote}</p>
                </div>
                <span className="era-chip shrink-0">
                  {p.done} of {p.total} done
                </span>
              </div>
              <ul className="mt-3">
                {track.steps.map((step) => (
                  <li
                    key={step.key}
                    className="era-hairline grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b py-3 last:border-b-0"
                  >
                    <span className="min-w-0 text-sm text-foreground">{step.clientLabel}</span>
                    <StepLight status={stepStatus(steps, track.track, step.key)} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Staff control. Two independent switches decide whether a client is getting
 * each agent at all, and every step below is set by hand. Writes are
 * authorized by the is_platform_staff() policies on both tables.
 */
export function AiAgentDeliveryEditor({ businessId }: { businessId: string }) {
  const fetchDelivery = useServerFn(getAiAgentDelivery);
  const saveTrack = useServerFn(setAiAgentTrack);
  const saveStep = useServerFn(setAiAgentStep);
  const queryClient = useQueryClient();

  const delivery = useQuery({
    queryKey: ["ai-agent-delivery", businessId],
    queryFn: () => fetchDelivery({ data: { businessId } }),
    retry: false,
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["ai-agent-delivery", businessId] });

  const trackMutation = useMutation({
    mutationFn: (vars: { track: AiAgentTrack; isEnabled: boolean }) =>
      saveTrack({ data: { businessId, ...vars } }),
    onSuccess: invalidate,
  });

  const stepMutation = useMutation({
    mutationFn: (vars: { track: AiAgentTrack; stepKey: string; status: AiStepStatus }) =>
      saveStep({ data: { businessId, ...vars } }),
    onSuccess: invalidate,
  });

  const enabled = delivery.data?.enabledTracks ?? [];
  const steps: AiAgentStepRow[] = delivery.data?.steps ?? [];
  const error = (trackMutation.error ?? stepMutation.error) as Error | undefined;

  return (
    <section className="era-card p-5">
      <h2 className="text-base font-semibold">AI agent delivery</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Switch on only what this client actually ordered. Some clients are SMS only. Nothing here
        is automatic: every step is real manual work you mark yourself.
      </p>

      <div className="mt-4 space-y-6">
        {AI_AGENT_TRACK_LIST.map((track) => {
          const isOn = enabled.includes(track.track);
          const p = trackProgress(steps, track);
          return (
            <div key={track.track} className="rounded-lg border border-border/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{track.label}</h3>
                  <p className="text-xs text-muted-foreground">
                    {isOn ? `${p.done} of ${p.total} done` : "Not part of this client's build"}
                  </p>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={isOn}
                    disabled={trackMutation.isPending}
                    onChange={(e) =>
                      trackMutation.mutate({ track: track.track, isEnabled: e.target.checked })
                    }
                  />
                  This client is getting it
                </label>
              </div>

              {isOn && (
                <ul className="mt-3">
                  {track.steps.map((step) => {
                    const current = stepStatus(steps, track.track, step.key);
                    return (
                      <li
                        key={step.key}
                        className="era-hairline grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b py-3 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">{step.label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>
                          <StepLight status={current} />
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                          {AI_STEP_STATUSES.map((s) => (
                            <button
                              key={s}
                              type="button"
                              disabled={stepMutation.isPending}
                              onClick={() =>
                                stepMutation.mutate({
                                  track: track.track,
                                  stepKey: step.key,
                                  status: s,
                                })
                              }
                              className={`rounded-md border px-2.5 py-1 text-xs transition ${
                                current === s
                                  ? "border-primary bg-primary/15 text-foreground"
                                  : "border-border/70 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {AI_STEP_STATUS_LABELS[s]}
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error.message}</p>}
    </section>
  );
}
