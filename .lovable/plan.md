# AI chat assistant for every client site

A chat bubble on every client's public website, on all three tiers, with no
entitlement gate. It answers questions about that client's services, prices,
how long jobs take, and opening hours, and can start a booking request — always
using that client's own live records.

## How it stays truthful

The assistant is never asked to remember or guess a business's details.

1. Every message the visitor sends triggers a fresh read of that client's
   current services, prices, durations, opening hours, location, and active
   team members straight from the database at that moment. Nothing is baked
   into the assistant's wording and nothing is cached between messages, so a
   price edited in the Catalog tab a minute earlier is the price quoted.
2. The assistant is not allowed to state a price by writing one out. To quote,
   it must call a quote step that adds up real catalog rows by their IDs and
   returns the total and duration. If it names a service that doesn't exist in
   that client's catalog, there is no ID to pass and the step fails rather than
   inventing a number.
3. To book, it calls the exact same guarded booking step the manual booking
   form already uses (`request_tenant_booking`), which re-prices from the
   catalog inside the database, checks the business is live, matches or creates
   the customer record, and writes the booking. There is no second pricing path
   to drift.
4. Availability is described from the client's real published hours only. The
   assistant proposes a requested time; the booking is created as **pending**
   exactly like the manual form, so nothing is promised as confirmed.
5. Instructions tell it plainly: if the answer isn't in the supplied live data,
   say so and offer the business's phone/email rather than guessing.

## How one client can never see another's data

- The conversation is bound to a business at the server, resolved from the
  website address the visitor is on — the same hostname-to-tenant resolution
  already proven in the isolation tests. The browser never supplies which
  business it is talking about.
- Every read and the booking step are filtered by that resolved business ID and
  run through the existing tenant-scoped access rules; there is no query in the
  chat path that reads across businesses.
- The assistant only ever receives that one client's data in its context, so it
  has nothing else to leak, and any service ID a visitor tries to inject is
  rejected because it isn't in that business's catalog.
- An address attached to no client keeps returning "not found" — no chat.

## Cost control (runs on every tier, including test traffic)

- Short, capped conversations: a message limit per conversation and a hard cap
  on reply length; older turns are trimmed so context can't grow unbounded.
- Per-visitor and per-business rate limits (messages per minute and per day),
  enforced server-side, with a polite "please call us" fallback when hit.
- A compact prompt: only the catalog fields needed (name, price, duration,
  short description) and hours — not the whole database.
- Uses the efficient default model with reasoning off for this task.
- Clients whose business isn't live (unpaid/expired) get no chat at all.
- Server-side daily spend guard per business: past the cap, the widget shows a
  contact-us message instead of calling the model.

## What gets built

- Chat server functions: tenant-resolved context load, guarded quote step,
  booking step reusing the existing database booking function, rate limiting.
- A branded chat bubble component using each client's own colours, added to the
  shared public site template (and the VDS variant, which keeps its
  vehicle-specific booking fields).
- Rate-limit/usage table keyed by business, with the same scoping rules.

## Acceptance test before it's called done

Spin up a throwaway client of a business type unlike any existing one, feed it
only onboarding data, then verify on its own site: it answers only from that
catalog, refuses a service it doesn't offer, quotes a total that matches the
booking form's total to the cent, creates a real pending booking visible in
that client's Bookings tab, never mentions ERA or another client, and stops
responding once the message cap is hit. Then delete the test client.
