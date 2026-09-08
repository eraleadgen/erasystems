# Send the erasystems.lovable.app address to eraleadgen.com

Today that address serves the full ERA marketing site as a second public front door.
After this change, anyone opening it lands on eraleadgen.com instead, with the same
path they asked for preserved.

Nothing about the custom domains changes: eraleadgen.com, www.eraleadgen.com and
test.eraleadgen.com each point at the hosting directly and never pass through the
lovable.app address. No Primary flag is set, so no other domain starts redirecting.

## What stays working

- The editor preview address — untouched, so day-to-day work is unaffected.
- The payment webhook and the two scheduled jobs (daily expiry, monthly statements),
  which call in over a lovable.app address. These are exempt from the redirect.
- Client domains and the client portals, unchanged.

## Behaviour

| Address | Before | After |
| --- | --- | --- |
| erasystems.lovable.app (and its stable project alias) | ERA marketing site | 308 redirect to the same path on eraleadgen.com |
| any /api/public/... path on those addresses | works | works, no redirect |
| id-preview--... | ERA marketing site | unchanged |
| eraleadgen.com / www / test | unchanged | unchanged |

## Technical notes

- Add a server-side redirect in the request path (`src/server.ts`), evaluated before
  routing so it costs one hop and never renders.
- Match on the published-host names only: `erasystems.lovable.app` and
  `project--<id>.lovable.app`. Explicitly exclude `id-preview--*` and any hostname
  where the path starts with `/api/public/`.
- Permanent (308) redirect preserving path and query string, targeting
  `https://eraleadgen.com`.
- `src/lib/tenant-hostname.ts` keeps treating `*.lovable.app` as a platform host; this
  change sits in front of tenant resolution and does not alter it.

## Verification after the change

Re-request each address and record the result: the two lovable.app names return 308 to
eraleadgen.com, the three custom domains still return 200 with their own content, a
`/api/public/` path on the lovable.app name returns its normal response, and the editor
preview still loads.
