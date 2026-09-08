# Partner / referral network (Enterprise)

Turns the current "partner network" tier flag into working referral tracking.

## What it does

Every Enterprise business gets a permanent referral code (e.g. `VDS-7K2Q`) and a
shareable link. When someone follows that link to another business's public site
and books, the booking is credited to the referring business. Each business sees a
record of the referrals it sent and the bookings that resulted — and nothing else.

## How attribution is tied to a booking

Belt and braces, in this order:

1. **Link parameter.** `https://<partner-site>/?ref=VDS-7K2Q`. On arrival the code is
   validated against real codes and stored in the visitor's browser for 30 days.
   Invalid or unknown codes are dropped silently.
2. **Code entered at booking.** The booking form gains one optional field,
   "Referral code", pre-filled when the link carried one. This covers word of mouth,
   printed cards and phone-relayed codes.

At submission the code travels with the booking request. The server resolves the code
to a business id itself and stamps the booking; the browser never sends a business id.
Rules enforced server-side:

- Unknown, inactive, or non-Enterprise code → booking still succeeds, unattributed.
- A business cannot refer to itself.
- Attribution is set once at creation and is never editable afterwards.

## Incentive mechanic

**Tracking only for this build.** No credits, discounts, or payouts. The record keeps
booking value per referral, so a commission or credit scheme can be layered on later
without re-tracking anything. Money movement should not be invented before you have
decided the commercial terms.

## Scoping (one business never sees another's data)

- Referral codes live on a new row per business; the code itself is public by design
  (it appears in links), but only the owning business can read its own row.
- A booking carries `referred_by_business_id`. Two separate read paths:
  - The **receiving** business sees the booking as it does today, plus "Referred by
    <partner name>".
  - The **referring** business sees only: date, receiving business name, booking
    status, and value — via a server function that filters on
    `referred_by_business_id = <their own business id>`, resolved from their own
    membership row, never from the request.
- Database policies keep both paths business-scoped, matching the pattern already
  proven for bookings and customers. No elevated access is introduced.
- A referrer never sees the end customer's name, email, or phone — that belongs to the
  business that served them.

## Where it appears

- **Client portal → new "Referrals" tab**, Enterprise-gated by the existing
  `partner_network` feature: the business's own code, copy-able link, a running list
  of referrals sent with status and value, and simple totals.
- **Public booking form**: one optional referral code field, on every tier (any
  business can *receive* a referred booking; only Enterprise can *send* one).
- **Agency Console → client detail**: staff can see a client's code and referral count.

## Technical notes

- Migration: `business_referral_codes` (business_id, code, is_active) and
  `bookings.referred_by_business_id`, both with grants and business-scoped policies.
- Resolution and stamping happen inside the existing `request_tenant_booking`
  function so the chat widget, the public form and any future path all attribute
  identically — no second code path.
- Code capture on `?ref=` handled in the tenant site shell; stored client-side only as
  a hint, always re-validated server-side.

## Acceptance test before this is called done

Two throwaway businesses: one Enterprise referrer, one Basic receiver. Book through the
referral link, confirm the booking is credited, confirm the referrer's tab shows it with
value but no customer contact details, confirm the receiver sees the customer normally,
confirm a self-referral and a made-up code both produce an unattributed booking, and
confirm a third business's signed-in read returns nothing.
