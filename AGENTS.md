<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Elevated (service-role) database access

`supabaseAdmin` bypasses RLS. Before adding any call site, read
`docs/elevated-access.md` and follow its rules: elevation only for provisioning,
verified webhooks, and platform-staff work; explicit `business_id` scoping on every
query; tenant id from server context or a verified payload, never client input;
caller authorized first through the RLS-scoped client; and a new row added to the
register in the same change.

- Purchase agreement text lives only in src/lib/agreement.ts (versioned); checkout, admin download and template all render from it, and checkout records acceptance in agreement_acceptances. Why: one source keeps signed terms consistent.
- Signed-in server functions require a remembered-device cookie (src/lib/device-trust.server.ts, enforced in src/start.ts); codes are issued only by /api/public/device/*. Why: email 2-step check must be enforced server side, not just on the login page.
- Recurring billing runs on Stripe subscriptions mirrored in business_billing (synced from Stripe's API, never payloads); ERA-side billing edits push to Stripe with no proration. Why: the amount ERA shows must equal what Stripe charges.
