/**
 * Enterprise AI agent delivery: two genuinely independent tracks.
 *
 * Nothing here is inferred from the plan tier. Being Enterprise makes a track
 * *available*; only an explicit staff switch turns one on for a business. A
 * client who never ordered the voice agent never sees a voice agent status.
 *
 * Browser-safe: the Agency Console and the client portal render from this one
 * source so the two can never describe different steps.
 */

export const AI_AGENT_TRACKS = ["ai_sms", "ai_voice"] as const;
export type AiAgentTrack = (typeof AI_AGENT_TRACKS)[number];

export const AI_STEP_STATUSES = ["not_started", "in_progress", "blocked", "done"] as const;
export type AiStepStatus = (typeof AI_STEP_STATUSES)[number];

export const AI_STEP_STATUS_LABELS: Record<AiStepStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

export type AiAgentStepDef = {
  key: string;
  /** Label staff see in the console. */
  label: string;
  /** Plain-English label the client sees on their portal. */
  clientLabel: string;
  detail: string;
};

export type AiAgentTrackDef = {
  track: AiAgentTrack;
  /** Staff-facing name. */
  label: string;
  /** Client-facing name. */
  clientLabel: string;
  /** Honest one-liner shown to the client under the track heading. */
  clientNote: string;
  steps: AiAgentStepDef[];
};

export const AI_AGENT_TRACK_DEFS: Record<AiAgentTrack, AiAgentTrackDef> = {
  ai_sms: {
    track: "ai_sms",
    label: "SMS agent setup",
    clientLabel: "AI SMS agent",
    clientNote:
      "Each step is set by hand by your ERA team as the real work is done. Carrier registration is reviewed by the mobile networks, not by us, and usually takes several business days.",
    steps: [
      {
        key: "twilio_number_provisioned",
        label: "Twilio number provisioned",
        clientLabel: "Text-message number set up",
        detail: "Number purchased on the ERA account and assigned to this business.",
      },
      {
        key: "a2p_submitted",
        label: "A2P brand and campaign submitted",
        clientLabel: "Carrier registration submitted",
        detail: "Brand and campaign filed with the carrier registry, business details verified.",
      },
      {
        key: "a2p_approved",
        label: "A2P approved",
        clientLabel: "Carrier registration approved",
        detail: "Campaign approved by the registry, throughput confirmed on the number.",
      },
      {
        key: "openai_configured",
        label: "OpenAI integration configured",
        clientLabel: "AI assistant connected",
        detail: "Model, system prompt and catalog grounding wired for this business.",
      },
      {
        key: "tested_live",
        label: "Tested live",
        clientLabel: "Tested end to end",
        detail: "Real inbound text answered correctly, opt-out honoured, handoff verified.",
      },
    ],
  },
  ai_voice: {
    track: "ai_voice",
    label: "Voice agent setup",
    clientLabel: "AI voice agent",
    clientNote:
      "Each step is set by hand by your ERA team as the real work is done. Nothing here advances on its own.",
    steps: [
      {
        key: "twilio_number_linked",
        label: "Twilio number linked",
        clientLabel: "Phone number linked",
        detail: "Voice-capable number pointed at the agent, forwarding and fallback set.",
      },
      {
        key: "retell_configured",
        label: "Retell agent configured",
        clientLabel: "Call assistant configured",
        detail: "Greeting, qualification script, booking handoff and after-hours behaviour built.",
      },
      {
        key: "tested_live",
        label: "Tested live",
        clientLabel: "Tested end to end",
        detail: "Real inbound call answered, booking handoff and voicemail fallback verified.",
      },
    ],
  },
};

export const AI_AGENT_TRACK_LIST: AiAgentTrackDef[] = AI_AGENT_TRACKS.map(
  (t) => AI_AGENT_TRACK_DEFS[t],
);

export type AiAgentStepRow = {
  track: AiAgentTrack;
  stepKey: string;
  status: AiStepStatus;
  note: string | null;
  updatedAt: string;
};

export type AiAgentDelivery = {
  businessId: string;
  /** Only tracks explicitly switched on for this business. */
  enabledTracks: AiAgentTrack[];
  steps: AiAgentStepRow[];
};

export function stepStatus(
  steps: AiAgentStepRow[],
  track: AiAgentTrack,
  stepKey: string,
): AiStepStatus {
  return steps.find((s) => s.track === track && s.stepKey === stepKey)?.status ?? "not_started";
}

export function trackProgress(steps: AiAgentStepRow[], track: AiAgentTrackDef) {
  const done = track.steps.filter((s) => stepStatus(steps, track.track, s.key) === "done").length;
  return { done, total: track.steps.length };
}
