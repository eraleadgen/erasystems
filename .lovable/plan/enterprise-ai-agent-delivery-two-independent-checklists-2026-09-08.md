# Enterprise AI agent delivery: two independent checklists

## Closing summary of the analytics work just finished

- The Analytics tab for Enterprise clients now computes revenue trends over a selectable range, customer lifetime value, new vs repeat customers, and per-service profitability from that business's own bookings and customers only.
- One shared calculation is used everywhere. The monthly statement document reuses the exact same function as the dashboard, so a statement can never disagree with the screen.
- Statements are generated on demand from the Analytics tab as a printable one-page branded document, and there is now an opt-in "email this to us every month" setting plus a "send me last month's statement now" button. A real test send was delivered to support@eraleadgen.com.
- Verified with two months of temporary test data that every figure matched, cancelled work was excluded from revenue, pending work stayed in pipeline, and another business's data was never reachable.
- Open item: the automatic first-of-the-month send runs through a scheduled endpoint that has not yet been proven firing on a real calendar month. The statement link in the emailed version needs the app republished to work on the live site.

## What replaces the single flag

Today the client portal shows one line, "AI Voice & SMS agent — Pending", derived from the tier feature. That becomes two separate, independently tracked build tracks, each with its own ordered steps that staff mark by hand.

SMS agent track (`ai_sms`):
1. Twilio number provisioned
2. A2P brand and campaign submitted
3. A2P approved
4. OpenAI integration configured
5. Tested live end to end

Voice agent track (`ai_voice`):
1. Twilio number linked
2. Retell agent configured
3. Tested live end to end

Each step carries its own status using the existing delivery vocabulary: Not started, In progress, Blocked, Done. No step is automated or evidence-driven — this is real manual carrier and vendor work, so staff set every one.

## How a business is scoped to SMS-only vs SMS-plus-voice

Scope is an explicit staff decision, never inferred from the tier. A new small table records, per business, whether the SMS track applies and whether the voice track applies, both defaulting to off. Being Enterprise makes the tracks *available* to turn on; it never turns them on.

- In the Agency Console, each Enterprise client gets two toggles: "This client is getting the SMS agent" and "This client is getting the voice agent".
- VDS is scoped SMS-only when it is onboarded: SMS on, voice off. The voice track then does not exist for VDS anywhere — not in the staff checklist, not in their portal.
- A track that is off shows nothing to the client at all. It is not shown as pending, not shown as unavailable.

## How status flows to the client

The client portal reads the same rows, filtered to tracks that are switched on for their business.

- No track on: the AI agent section is absent from their portal entirely.
- A track on: they see that track's steps with plain-English labels and the real status staff set, plus a short honest line such as "Carrier approval is out of our hands and typically takes several business days."
- Nothing is auto-advanced and nothing implies automation. A step is Done only because a person marked it Done.
- Clients can read; only platform staff can write. Enforced by row-level policies, so a client attempting a write gets a policy denial rather than a silent success.

## Technical notes

- New table `business_ai_agent_tracks` (business_id, track, is_enabled) and `business_ai_agent_steps` (business_id, track, step_key, status, note, updated_at), both business_id scoped, RLS: members and staff read, staff write, with GRANTs.
- Step definitions live in one shared browser-safe module so the console and the portal render from the same source.
- The existing generic `business_launch_status` line for `voice_sms_agent` is dropped from the portal's capability list so it is not shown twice.
- Server functions follow the existing pattern in `launch-status.functions.ts`: RLS-scoped client, explicit business_id, no elevated access.
- No changes to pricing, entitlements, other tiers, or anything outside these two checklists.
