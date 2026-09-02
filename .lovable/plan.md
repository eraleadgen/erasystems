# Client onboarding wizard (post-invite, pre-payment)

Registration created an identity only: an auth user, no business, no membership. Onboarding is the step that turns that identity into a tenant. Payment stays after it, so nothing here touches billing.

## How it ties to the invite-created account

The wizard is owned by the signed-in user, not by a business (there isn't one yet). Everything is keyed on `auth.uid()`.

- The route lives under the authenticated layout. A visitor with no session goes to `/auth`; there is no way to start onboarding without having redeemed an invite, because that is the only way an account exists at all.
- On first load the server looks for an onboarding draft for `auth.uid()`. If none exists it creates exactly one. That row is the whole session.
- The prospect's name and email are already known from the invite, so step one is pre-filled rather than re-asked.

## Resume, not duplicate

The anti-duplication guarantee is structural, not UI-level:

- `onboarding_drafts` has a **unique constraint on `user_id`**. One person cannot hold two in-flight onboardings, no matter how many times they open the page, refresh mid-step, or come back a week later on another device.
- Getting the draft is an upsert-on-conflict-do-nothing followed by a read, so a double-submit or two tabs racing produce the same single row.
- Each step saves its own slice on blur/next into a `data` JSONB column, plus `current_step`. Reopening `/onboarding` sends the user back to `current_step` with every earlier answer filled in.
- Nothing is written to `businesses`, `services`, or `business_members` until the final submit. An abandoned session leaves a draft row and zero tenant rows — no half-built tenant, no orphan slug squatting on a name, nothing for the platform to clean up.
- Finishing sets `status = 'completed'` and stamps `business_id`. A completed draft makes `/onboarding` redirect to the dashboard instead of restarting, so the final submit cannot run twice and mint two businesses.

## Data model

New table `onboarding_drafts`:

| field | purpose |
|---|---|
| `user_id` | unique; the invite-created account that owns this session |
| `status` | `in_progress` / `completed` |
| `current_step` | where to resume |
| `data` | JSONB, one key per step (`basics`, `branding`, `catalog`, `team`, `integrations`) |
| `business_id` | null until the final submit, then the tenant this became |
| `created_at`, `updated_at` | |

RLS: the same `auth.uid()`-scoped pattern already in use. A user reads and writes only their own draft; platform staff can read for support. No `anon` grants at all.

Logos go to a private storage bucket under a `user_id`-prefixed path with matching per-user storage policies, and are copied to the business on completion.

## The steps

1. **Business basics** — legal name, display name, address, timezone, contact, and weekly hours.
2. **Branding** — logo upload, primary and accent colors (feeds the existing `brand_primary` / `brand_accent` fields).
3. **Service catalog** — repeatable rows of name, description, duration, price; becomes `services`.
4. **Team / specialists** — only shown when relevant to their tier. Collected as names and emails to invite later; no accounts are created here, since staff invites go through the existing invite system.
5. **Integrations** — domain, email, and phone intent captured as declared values. Nothing is connected or verified in the wizard; these become setup tasks after payment.
6. **Review** — everything on one page, then submit.

## Completion

One server function, called once, does the provisioning transactionally:

- creates the `businesses` row with `is_active = false` (nothing is publicly live before payment) and `plan_tier` left at its default — tier is a staff-set commercial field, never chosen by the client in this wizard;
- creates the `business_members` row making this user `owner`;
- inserts the service catalog;
- marks the draft completed with its `business_id`.

Add-ons are untouched: they remain staff-set per client, exactly as built in the gating phase.

This is the first place a business gets created, so it needs elevated access for the insert (the `businesses` table denies client inserts by design). It follows `docs/elevated-access.md`: the caller is authorized first through the RLS-scoped client, the owner id comes from the verified session rather than the form, every write carries the freshly created `business_id` explicitly, and the register gets a new row in the same change.

## Verification before I call it done

- Abandoning mid-step and returning resumes at the same step with data intact, and creates no second draft.
- Two tabs racing the first load produce one draft row.
- Submitting twice creates one business, not two.
- A user cannot read or write another user's draft.
- After completion the business exists, inactive, with the correct owner and catalog, and no payment or tier change has occurred.
