# Real advanced analytics (Enterprise only)

Replaces the four counters on the Analytics tab with metrics computed from the
business's own bookings, customers and services. Scope is limited to the
Enterprise-gated Analytics tab: no other tab, page, table, policy or pricing
changes, and no elevated (service-role) access — everything is read through the
signed-in user's own RLS-scoped client, filtered by their `business_id`, the
same pattern the other client tabs already use.

## Time range

A selector on the tab: last 30 days, 90 days, 12 months, or year to date.
The chosen range is sent to the server, which reads all bookings in that window
(no 50-row cap). All figures below are computed over that window.

## How each metric is calculated

**Revenue trend**
- Counts only bookings with status `completed` — money actually earned, not
  requested. `cancelled` and `no_show` are excluded; `pending`/`confirmed` are
  shown separately as "booked, not yet completed" so the trend line isn't
  inflated by work that hasn't happened.
- Grouped by day for ranges up to 90 days, by month beyond that, using the
  booking's `starts_at` in the business's own timezone.
- Rendered as a bar/area chart plus totals: revenue, completed jobs, average
  ticket, and the change against the immediately preceding equal-length period.

**Customer lifetime value**
- Per customer record: sum of `total_cents` on their `completed` bookings, over
  the customer's whole history (lifetime is lifetime, not windowed), plus first
  and last booking dates and job count.
- Headline CLV = average of those per-customer totals, across customers who have
  at least one completed booking. Median is shown alongside, because one large
  job otherwise distorts a small book of business.
- Bookings with no `customer_id` attached (walk-ins typed by name only) are
  excluded from CLV and flagged with a count, so the number is honest rather
  than silently partial.
- A "top customers by lifetime value" table lists the top 10.

**New vs repeat**
- For each booking in the window, look up that customer's earliest booking date.
  If it equals the booking in question, the booking is "new customer"; otherwise
  "repeat".
- Reported as counts and revenue split for each, plus a repeat rate
  (repeat bookings / total attributed bookings), and new customers acquired in
  the window.

**Service profitability**
- Per `service_id`: bookings, completed revenue, average ticket, total booked
  minutes, and revenue per hour (completed revenue / booked hours) — the last is
  what actually ranks services, since a cheap 20-minute job can out-earn an
  expensive 3-hour one.
- Sorted by revenue, with revenue per hour shown next to it. Services with no
  bookings in the window are listed at zero rather than hidden, so gaps in the
  catalog are visible. "Profitability" here is revenue-based: the system holds no
  cost data, and the tab says so plainly rather than implying margin.

## Technical notes

- New `src/lib/analytics.functions.ts`: one `createServerFn` with
  `requireSupabaseAuth`, resolving the caller's business through the existing
  `callerBusiness` helper, then reading `bookings`, `customers` and `services`
  with explicit `.eq("business_id", …)`. Aggregation happens in the handler; the
  client receives finished numbers.
- Enterprise gating unchanged: the tab keeps `feature="advanced_analytics"`
  through the existing portal shell.
- `src/routes/_authenticated/analytics.tsx` is rewritten to render the new
  sections; charts use the `recharts` setup already in the project.
- No migration, no RLS change, no new permissions.
