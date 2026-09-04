# Automating the go-live workspace

Goal: you only touch the ~35% of steps that genuinely depend on the client's business. Everything the system can already prove, prove automatically. Everything repetitive, do in one click and in bulk across clients.

## 1. Classify every checklist step

Each step gets an automation mode:

- **auto** — the system decides the status from real data. You never click it.
- **assisted** — one button performs the work (send, schedule, initialise, publish), then the step marks itself done.
- **manual** — genuine per-client judgment. This is the set you actually work.

Expected split on the current 30-step list: roughly 11 auto, 8 assisted, 11 manual — so about a third stays hands-on, matching what you asked for.

### Auto (derived from data already in the system)
- Payment confirmed — from the verified payment row and active lifecycle
- Tier and add-on pricing locked — plan tier set and add-on rows active
- Kickoff call scheduled — a discovery/kickoff booking exists on the calendar
- Business profile verified — required profile fields all filled
- Brand assets received — logo present
- Service catalog entered — at least one active service with price and duration
- Domain connected — a verified domain row exists for the business
- Calendar connected — calendar link present
- A2P registration — mirrors the A2P status you already track on the client profile
- Website built / live — mirrors website status on the client profile
- Status lights live — every entitled capability set to live

### Assisted (one button)
- Kickoff invite send, access-handover request, brand-asset request, client website approval request, training-call booking, go-live announcement email, post-launch check-in booking, customer-import upload.

### Manual (your 35%)
Phone provisioning/porting, sending-domain records, payments connection, chat widget training, booking-flow config, portals, downloadable apps, automations, voice agent, ads, QA passes.

## 2. Derived status, with override

Auto steps display as computed and refresh on load; a manual toggle still overrides when reality differs, and the override is remembered. No auto step ever silently un-does something you set.

## 3. Client templates so a new signup starts pre-filled

On payment, the checklist is seeded for that client from the tier/add-on rules, auto steps immediately evaluated, and dates targeted against the 7-day window. A new client lands with the auto third already green.

## 4. Cross-client command view

New "Delivery" view in the Agency Console:
- One queue of every open step across every client, sorted by due day then risk
- Filters: due today, overdue, blocked, mine
- Bulk select across clients: set status, mark done, add a note in one action
- Per-client risk chip: on track / at risk / overdue against their day-7 target

## 5. Focus mode inside a client

The client workspace collapses auto and completed steps by default and shows only what needs you, with a "show everything" toggle.

## Technical notes

- New `automation` field on each task definition in `src/lib/delivery-tasks.ts` (`auto` with an evidence key, `assisted` with an action key, or `manual`).
- A staff-only server function computes evidence per business in one round trip (payments, addons, domains, services, provisioning, launch status, members, business fields) and returns derived statuses; `client_delivery_tasks` gains an `override` flag so manual wins over derived.
- Cross-client queue is one staff-scoped server function returning open steps for all active clients, with explicit `business_id` on every row; all writes keep going through the existing staff-only RLS policy.
- Bulk write reuses the existing upsert path, batched.
- Assisted actions reuse existing email and calendar plumbing; no new external services.

## What this does not change

Tier/add-on entitlement rules, payment and lifecycle logic, RLS scoping, and the client-facing status lights all stay exactly as they are.
