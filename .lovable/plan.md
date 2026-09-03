# ERA App: dashboard portal upgrade

A visual and structural upgrade of `/dashboard` into the account portal a client
lives in. No change to lifecycle behaviour: the `pending_payment` / `active` /
`expired` / `suspended` branching, the checkout panel, the terms fetch and the
payment reconciliation all keep their current logic and wiring exactly as they are.

## Shell

An app shell replaces the bare centered column:

```text
+----------------------------------------------------------+
| sidebar |  topbar: business name . lifecycle pill . user  |
|  logo   +------------------------------------------------+
|  Home   |                                                |
|  Setup  |   page content                                 |
|  Team   |                                                |
|  Billing|                                                |
+----------------------------------------------------------+
```

- Left rail with the real ERA logo, section links, collapsing to a sheet on mobile.
- Sticky topbar: business name, a lifecycle status pill, role chip.
- Only Overview is a live destination in this pass; sections that do not exist yet
  render as clearly labelled "coming with your plan" items rather than dead links.

## Overview page

1. **Status banner** driven by the same `STATE_COPY` map, restyled as a full-width
   card with a status dot, headline, body, and the reservation date line for
   `pending_payment`. Same conditions, same strings.
2. **Checkout panel** for `pending_payment` / `expired`, unchanged in behaviour:
   same terms query, same server-derived total, same redirect and same
   reconciliation effect. Restyled as a billing summary card with line items,
   a rule, a bold "Due today" row and a primary action button.
3. **Metric row**: services in catalog, plan tier, timezone, published state, as
   compact stat tiles instead of a definition list.
4. **Detail card**: web address (copy button), role, plan, timezone.
5. **Setup progress strip**: account, business setup, payment, live. Derived
   purely from data already in `MyBusiness`, no new server calls.

## Visual language

Portal-scoped tokens in `src/styles.css` under a `.era-app` class so the marketing
site and tenant sites are untouched: deep teal surfaces, silver hairline borders and
metallic dividers, gold reserved for the single active state. Loading states become
skeletons rather than a line of text. Motion is limited to soft card reveal and
hover lift, all under the existing `prefers-reduced-motion` guard.

## Technical notes

- `src/routes/_authenticated/dashboard.tsx` keeps its route definition, `head()`,
  `validateSearch`, queries, mutations and effects; only the returned JSX changes.
- New presentational files: `src/components/app/app-shell.tsx`,
  `app-sidebar.tsx`, `stat-tile.tsx`, `status-banner.tsx`, `setup-progress.tsx`.
- Nothing in `business.functions.ts` or `payments.functions.ts` changes.
