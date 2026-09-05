# Align pricing and show setup fees publicly

## What's happening now

The system charges $200 / $500 / $1,000 a month, while the public pricing page
advertises $199 / $499 / $1,499. The one-time setup fees ($1,000 Basic,
$2,000 Growth, $3,000 Enterprise) are only visible internally.

## What changes

1. Make the advertised monthly prices the real ones everywhere: Basic $199,
   Growth $499, Enterprise $1,499. These are what checkout charges, what the
   client portal shows, and what the signed terms record, unless staff set a
   custom amount on the invite (that override keeps working exactly as it does now).
2. Show the one-time setup fee on each tier on the public pricing page and in the
   home page pricing summary, presented clearly as a one-time fee separate from
   the monthly amount.
3. Keep the structured pricing data in the page's search listing in step with the
   new numbers.

## Notes

- Existing clients already on a plan are unaffected: their agreed amounts are
  stored per business and are not recalculated.
- Add-on pricing stays per client and staff-entered; nothing here touches it.

## Technical details

- `src/lib/pricing.ts`: set `monthlyCents` to 19900 / 49900 / 149900. Setup fees
  unchanged (100000 / 200000 / 300000). This table is the single source both the
  client-facing selection UI and the server-side recompute in
  `src/lib/terms.server.ts` read, so both move together.
- `src/components/marketing/content.ts`: add a `setupFee` string to each tier entry.
- `src/routes/pricing.tsx`: render the setup fee under the monthly price, and update
  the JSON-LD offers to the same amounts.
- Home page pricing summary: same setup-fee line, kept consistent with `/pricing`.
