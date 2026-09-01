# Invite-only registration

No public sign-up. An account can only be created by redeeming a staff-generated invite that was issued to one named prospect. The boundary is enforced on the server, in the database, and in the auth provider — not by hiding a URL.

## The core decision: signups are turned off at the auth provider

Today anyone can hit the auth API and create an account. Step one is to disable open signup in the backend's auth settings. After that, `signUp()` from a browser fails outright, and the only path that can mint a user is a server function that has already validated an invite token. That is what makes the invite a real boundary instead of an unlinked page.

## Token design

- **Generated**: 32 bytes from a cryptographic RNG, encoded base64url (~43 chars). Not a UUID, not derived from the email, not sequential — no guessable structure and far beyond brute force.
- **Stored**: only the SHA-256 hash of the token lands in the database. The plaintext is returned exactly once, to the staff member who created the invite, so it can be pasted into the email. A database leak yields hashes, not usable invites.
- **Bound to one prospect**: the row carries the prospect's email (normalized lowercase), their name, and the staff user who issued it. At redemption the submitted email must equal the invited email. Forwarding the link to a colleague does not work.
- **Expires**: 7 days. Long enough to survive a weekend and a missed email after a discovery call, short enough that a link sitting in an inbox or forwarded thread stops working. Staff can revoke earlier, and re-issuing is one click.
- **Single-use**: consumed atomically at redemption. A conditional update flips the row to `accepted` only if it is still `pending` and unexpired; if that update touches zero rows, redemption fails. Two simultaneous submissions cannot both win.
- **Rate limited**: repeated failed lookups from one address are throttled, and validation always does the hash comparison so a bad token and a used token take the same time and return the same generic message.

## Data model

New table `invites`:

| field | purpose |
|---|---|
| `token_hash` | SHA-256 of the token, unique. The token itself is never stored |
| `email`, `full_name` | the one prospect this invite is for |
| `status` | `pending` / `accepted` / `revoked` |
| `expires_at` | issued time + 7 days |
| `invited_by`, `accepted_at`, `accepted_user_id` | audit trail |
| `notes` | discovery-call context for staff |

RLS: platform staff can read, create, and revoke invites. Members and anonymous visitors get nothing — no `anon` privileges at all, no public read of any invite column. This reuses the existing `is_platform_staff()` predicate; no new access mechanism.

Note that invites are deliberately not scoped to a `business_id`: this stage is identity only, and the prospect has no business yet. Business creation stays in a later onboarding phase.

## Request flow

1. Staff open an internal invites screen, enter the prospect's name, email, and notes, and get a one-time link: `https://eraleadgen.com/register?token=…`. The plaintext is shown once and never retrievable again.
2. The visitor opens the link. The register route asks the server to preview the token. The server hashes it, looks it up, and returns only `{ valid, email, fullName }` — or a flat "this invite is not valid" with no hint about which reason. An invalid or missing token renders no form at all.
3. The visitor sets a password (email is pre-filled and locked to the invited address).
4. Submission goes to a single server function that, in order: re-validates and atomically consumes the invite, creates the auth user with the email already confirmed, and records who accepted. If user creation fails, the consumption is rolled back so the invite stays usable.
5. The client signs in with the new credentials and lands in onboarding. No business is created.

## Elevated access

Creating a user requires elevated backend privileges — this will be the first such call site in the project. It follows the rules already written in `docs/elevated-access.md`: caller gated by a verified invite rather than a session, no tenant data touched, no client-supplied identifiers trusted (the email comes from the invite row, not the form), and a new entry added to the register in the same change.

## What gets built

- Migration: `invites` table, grants, RLS policies, and the atomic consume function.
- Auth setting: public signup disabled.
- `src/lib/invites.functions.ts` — issue, preview, revoke, redeem.
- `src/routes/register.tsx` — token-gated registration form.
- `src/routes/admin.invites.tsx` — staff issue/revoke screen with one-time link display.
- `docs/elevated-access.md` updated with the new call site.

## Verification before I call it done

- A random or altered token renders no form and creates nothing.
- A redeemed token fails on second use; two concurrent redemptions produce exactly one account.
- An expired invite (clock moved past `expires_at`) is rejected.
- Submitting a different email than the invited one is rejected.
- A direct call to the browser signup API, bypassing the UI entirely, fails because signups are off.
- Anonymous and non-staff reads of the invites table return nothing at the privilege layer.
