# Logos, "ERA Member" label, and quote-matched Stripe payments

## 1. Logos
- The onboarding form already has a logo upload. Add the uploaded logo to the agency console Inbox (preview + "Download logo") so you can use it on the client's website.
- Clients keep changing their portal logo from Business information > Portal theme. Fix the current limit so every team member on the account sees the logo, not just the person who uploaded it.

## 2. "ERA Member" label
- Replace "Client portal" under the logo with "ERA Member", with a slow (about 3 second) green glow pulse. The pulse stops for people who turn off motion on their device.

## 3. Payments that match your quote exactly
Today clients pay one time, and nothing charges them monthly. This changes to:
- **Stripe subscription:** checkout charges the setup fee once plus the first recurring payment, then Stripe charges your custom amount automatically every month (or quarter/year, per the invite).
- **Exact amounts:** the setup fee and recurring amount always come from the invite you sent. A quote summary on the checkout page and in Stripe shows both lines.
- **Pay button in email:** the invite email shows the quote (setup fee + monthly amount) and a "Pay with Stripe" button.
  - Because the account and business must exist before Stripe can charge it, the button takes them to sign in / create the account, through onboarding, then straight to the Stripe checkout with those exact amounts. Once they've finished onboarding, the button goes directly to Stripe.
- **Update billing links to Stripe:** saving new prices or a plan change in the agency console updates their Stripe subscription from the next billing date (no partial charges). Cancellations stop Stripe at the end of the paid period.
- **Failed payments:** support@eraleadgen.com gets an email and the account is flagged.
- **Existing clients (like VDS):** a "Start subscription" button on their client page sends them a payment link for their saved amounts.
- Tested end to end with Stripe test cards before going live.

## Technical details
- Checkout session switches to `mode=subscription` with a recurring `price_data` line (interval from invite) + one-time setup line item; store `stripe_customer_id`/`stripe_subscription_id` on a new nullable `business_billing` table (RLS, staff + members read).
- Webhook handles `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated/deleted`, all re-verified via Stripe API.
- `updateClientBilling` calls Stripe subscription update with `proration_behavior=none`; plan-change cron sets `cancel_at_period_end`.
- Invite email gains quote block + `/register?token=…&next=pay`; dashboard auto-opens checkout when `next=pay`.
- Logo: copy onboarding logo path onto `businesses.logo_url`-style storage readable by members; Inbox gets a signed URL.
