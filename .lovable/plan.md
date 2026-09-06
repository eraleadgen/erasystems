# Audit against the current model, then real Growth portals

## Part 1: what's actually there today

Checked every tab in the staff console and the client portal, plus the pricing
and entitlement data behind them.

### Matches the current model as-is

- **Three tiers everywhere.** Basic / Growth / Enterprise, no fourth tier
  anywhere in the pricing table, the marketing pages, the invite form, or the
  plan picker.
- **AI Voice & SMS is Enterprise-only.** It's a tier feature, not an add-on:
  it only appears in the Enterprise feature list and the Enterprise delivery
  checklist. There is no way to buy it separately.
- **Add-ons stay orthogonal to tiers.** Ad Management and White-Label live in
  their own per-client records; upgrading a tier never grants one.
- **Staff Add-ons tab** — correct. Staff pick a client, switch each add-on on
  or off, and type the amount. No platform-wide rate.
- **Staff Clients list and client detail** — correct. Shows tier, lifecycle,
  and each add-on with its per-client amount.
- **Staff Invites** — correct. Tier, monthly, setup fee and per-add-on amounts
  are all typed in per invite, with the invite terms overriding list pricing.
- **Staff Delivery** — correct. The go-live checklist keys off actual tier
  features and actual add-on records.
- **Public pricing and add-ons pages** — correct. Three tiers with monthly +
  setup fee; both add-ons shown as "custom pricing, available on any tier".
- **Client Overview, Business information, Catalog, Bookings, Billing** —
  correct and genuinely working off the client's own data.

### References an outdated structure and needs updating

- **Fixed White-Label prices in the pricing table.** Each tier carries a
  hard-coded downloadable-app price ($5,000 Basic / $7,500 Growth / $9,000
  Enterprise). That contradicts "custom-priced, no fixed rate", and it's tier-
  dependent, which contradicts add-ons being tier-independent.
- **Client Overview plan picker.** It renders the add-on with a checkbox
  reading "Add for $X one time" fed by that fixed price. Today the amount is
  never actually charged, because every tier is flagged "scoped on a call", so
  the checkbox branch is dead code carrying a wrong number behind it.
- **Self-serve plan selection writes that fixed price** into the client's
  add-on record when the checkbox path is taken. Same wrong-source problem.

### Placeholder or thin

- **Customers tab (Growth).** Not a customer account system. It groups past
  bookings by the typed-in name and counts them. Two people with the same name
  merge; one person who typed their name differently splits. No login, no
  history, no record a customer owns.
- **Team tab (Growth).** Lists membership rows and prints the raw internal user
  ID as the name, plus a role chip. No invite flow, no name, no schedule, no
  job assignment.
- **Analytics tab (Enterprise).** Four counters off the last 50 bookings.
  Real numbers, but not the "advanced analytics" the tier sells.
- **The database already has the right hooks and nobody uses them.** The
  booking record already carries a customer link and a specialist link. Both
  are always empty — no code writes or reads either.

## Part 2: building the Growth portals for real

Reuses what the audit confirms is correct: the same per-business scoping,
the same membership roles, the same booking record, the same tier gating.
Nothing about tiers, pricing, or add-ons is rebuilt.

### Customer accounts tied to bookings

1. A customer record per business: name, email, phone, notes, and an optional
   link to a login account. Bookings point at it via the link that already
   exists on the booking row.
2. Public booking matches on email (then phone) within that business and
   reuses the existing customer, or creates one. Existing bookings are matched
   back by email/phone in one pass so history isn't lost.
3. The Customers tab becomes real: per-customer detail with contact info, full
   booking history, lifetime value, and manual edit/merge for duplicates.
4. Customer login: a customer receives an invite to their own account and sees
   only their own bookings for that business — upcoming, past, and the amount.
   Same invite-only discipline as everywhere else; no public sign-up.

### Specialists assigned to jobs

1. Staff/owner invites a specialist into the business with the specialist role
   that already exists, including their display name (which fixes the raw ID
   showing on the Team tab).
2. Working hours per specialist, and which services they can perform.
3. Booking assignment: the owner assigns a specialist to a booking from the
   Bookings tab, using the link already on the booking row.
4. Specialist view: a signed-in specialist sees only jobs assigned to them —
   day and week — and can mark a job complete or a no-show.
5. Optional and gated behind the same setting: the public booking form lets a
   customer pick an available specialist for the chosen service.

### Access rules

Customer records and specialist records are scoped to their business the same
way everything else is. A customer sees only their own rows; a specialist sees
only jobs assigned to them; owners and admins see the whole business; platform
staff see it for support. Both surfaces stay gated on the Growth features that
already exist.

### Pricing cleanup (small, included here)

Drop the fixed per-tier White-Label price and the dead "Add for $X" checkbox so
the only source of an add-on amount is what staff enter per client.

## Technical notes

- New tables: `customers` and `specialist_profiles` (+ availability and
  service coverage), all `business_id` keyed with GRANTs and RLS in the same
  migration, following the existing pattern.
- Reuse the existing `bookings.customer_id` / `bookings.specialist_id`
  columns rather than adding new ones.
- New server functions in `src/lib/customers.functions.ts` and
  `src/lib/specialists.functions.ts`, RLS-scoped through
  `requireSupabaseAuth`; no elevated access needed.
- `src/lib/tenant-booking.functions.ts` gains customer upsert + optional
  specialist selection; `customers.tsx` and `team.tsx` are rewritten off the
  new reads; `bookings.tsx` gains assignment.
- `src/lib/pricing.ts` loses `appAddonCents`; `dashboard.tsx` and
  `plan-selection.functions.ts` drop the fixed-price branch.

## Acceptance test (run for real, results reported)

On a brand-new Growth client with no hand-written code:

1. Two bookings from the same email land on one customer; that customer signs
   in and sees both.
2. A specialist is invited and assigned; the specialist sees only their own jobs.
3. **Shared phone number.** Two different people using the same phone but
   different emails must stay two separate customers, not merge.
4. **Mistyped email.** The same person with a slightly different email is
   matched by phone where safe, and where it isn't, the result is two records
   that can be merged by hand rather than a wrong silent merge. Matching is
   exact-match only on normalized email, then phone, and only when the other
   identifier doesn't contradict — it never guesses at near-matches.
5. **Cross-business isolation.** A customer account is created in two different
   businesses with the same email and phone, and it is verified directly that
   signing in shows only the bookings of the business being viewed, never the
   other one's.

